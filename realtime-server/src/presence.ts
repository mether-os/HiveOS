import { Server, Socket } from "socket.io";
import { Redis } from "ioredis";
import { ObjectId } from "mongodb";
import { connectToDatabase } from "./db";

declare module "socket.io" {
  interface SocketData {
    user?: AuthenticatedUser;
    workspaceId?: string;
    docId?: string;
  }
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

function toObjectId(id: string): any {
  if (ObjectId.isValid(id)) {
    return new ObjectId(id);
  }
  return id;
}

async function indexMutationEventInDb(db: any, eventDoc: any) {
  try {
    await db.collection("knowledgeindices").updateOne(
      { entityId: eventDoc._id.toString() },
      {
        $set: {
          hiveId: eventDoc.hiveId,
          entityType: "mutation",
          title: `Mutation: ${eventDoc.eventType}`,
          content: `Actor: ${eventDoc.actorName}. Entity: ${eventDoc.entityId} (${eventDoc.entityType}).`,
          tags: [],
          status: null,
          metadata: {
            eventType: eventDoc.eventType,
            entityId: eventDoc.entityId,
            entityType: eventDoc.entityType,
            actorName: eventDoc.actorName
          },
          sourceUpdatedAt: eventDoc.timestamp,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("[Presence Indexer] Error indexing mutation event:", err);
  }
}

async function indexNodeInDb(db: any, workspaceId: string, nodeDoc: any) {
  try {
    await db.collection("knowledgeindices").updateOne(
      { entityId: nodeDoc.id },
      {
        $set: {
          hiveId: toObjectId(workspaceId),
          entityType: "node",
          title: nodeDoc.title,
          content: `${nodeDoc.description || ""} ${nodeDoc.category || ""}`.trim(),
          tags: nodeDoc.tags || [],
          status: nodeDoc.data?.status || null,
          metadata: {
            category: nodeDoc.category,
            priority: nodeDoc.data?.priority || null,
            createdBy: nodeDoc.createdBy ? nodeDoc.createdBy.toString() : null
          },
          sourceUpdatedAt: nodeDoc.updatedAt || new Date(),
          createdAt: nodeDoc.createdAt || new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("[Presence Indexer] Error indexing canvas node:", err);
  }
}

// Track active node locks by socket ID
// Maps: socketId -> Set of lock details { workspaceId, nodeId }
const activeLocks = new Map<string, Set<{ workspaceId: string; nodeId: string }>>();

export function registerPresenceHandlers(io: Server, socket: Socket, redisClient: Redis | null) {
  const user = socket.data.user as AuthenticatedUser;
  if (!user) return;

  const userId = user.id;

  // On connection, increment the user's connection count in Redis
  if (redisClient) {
    redisClient.incr(`presence:connections:${userId}`).then((count) => {
      if (count === 1) {
        // First connection, publish globally that user is online
        io.emit("user:status", { userId, status: "online", user });
      }
      redisClient.expire(`presence:connections:${userId}`, 86400); // 24 hours
    }).catch(err => console.error("[Presence Redis] Error incrementing connections:", err));
  } else {
    // Local fallback
    io.emit("user:status", { userId, status: "online", user });
  }

  // Helper to broadcast active members in a workspace
  const broadcastWorkspacePresence = async (workspaceId: string) => {
    try {
      const roomName = `workspace:${workspaceId}`;
      const sockets = await io.in(roomName).fetchSockets();
      
      const userMap = new Map<string, AuthenticatedUser>();
      for (const s of sockets) {
        const socketUser = s.data.user as AuthenticatedUser | undefined;
        if (socketUser) {
          userMap.set(socketUser.id, socketUser);
        }
      }
      const activeMembers = Array.from(userMap.values());
      
      io.to(roomName).emit("workspace:presence", {
        workspaceId,
        members: activeMembers
      });
      console.log(`[Presence] Broadcasted presence for workspace ${workspaceId}: ${activeMembers.length} users active.`);
    } catch (error) {
      console.error(`[Presence] Error broadcasting workspace presence for ${workspaceId}:`, error);
    }
  };

  // Helper to broadcast active members in a document
  const broadcastDocumentPresence = async (workspaceId: string, docId: string) => {
    try {
      const docRoomName = `workspace:${workspaceId}:document:${docId}`;
      const sockets = await io.in(docRoomName).fetchSockets();

      const userMap = new Map<string, AuthenticatedUser>();
      for (const s of sockets) {
        const socketUser = s.data.user as AuthenticatedUser | undefined;
        if (socketUser) {
          userMap.set(socketUser.id, socketUser);
        }
      }
      const activeMembers = Array.from(userMap.values());

      io.to(docRoomName).emit("document:presence", {
        workspaceId,
        docId,
        members: activeMembers
      });
      console.log(`[Document Presence] Broadcasted presence for doc ${docId}: ${activeMembers.length} users active.`);
    } catch (error) {
      console.error(`[Document Presence] Error broadcasting doc presence for ${docId}:`, error);
    }
  };

  // -------------------------------------------------------------------------
  // Workspace Rooms
  // -------------------------------------------------------------------------

  socket.on("workspace:join", async (payload: { workspaceId: string }) => {
    const { workspaceId } = payload;
    if (!workspaceId) return;

    console.log(`[Presence] Socket ${socket.id} (${user.name}) joining workspace: ${workspaceId}`);
    
    if (socket.data.workspaceId && socket.data.workspaceId !== workspaceId) {
      const prevWorkspace = socket.data.workspaceId;
      socket.leave(`workspace:${prevWorkspace}`);
      socket.data.workspaceId = undefined;
      await broadcastWorkspacePresence(prevWorkspace);
    }

    socket.join(`workspace:${workspaceId}`);
    socket.data.workspaceId = workspaceId;

    await broadcastWorkspacePresence(workspaceId);
  });

  socket.on("workspace:leave", async () => {
    const workspaceId = socket.data.workspaceId;
    if (!workspaceId) return;

    console.log(`[Presence] Socket ${socket.id} (${user.name}) leaving workspace: ${workspaceId}`);
    socket.leave(`workspace:${workspaceId}`);
    socket.data.workspaceId = undefined;

    await broadcastWorkspacePresence(workspaceId);
  });

  // -------------------------------------------------------------------------
  // Chat Collaboration
  // -------------------------------------------------------------------------

  socket.on("chat:message", async (payload: { text: string }) => {
    const workspaceId = socket.data.workspaceId;
    if (!workspaceId) return;

    try {
      const db = await connectToDatabase();

      // Security: Verify user belongs to hive (authenticated user id equals hive ownerId)
      const hive = await db.collection("hives").findOne({
        _id: toObjectId(workspaceId),
        ownerId: toObjectId(user.id)
      });

      if (!hive) {
        console.warn(`[Chat Security] User ${user.id} does not own or belong to hive ${workspaceId}`);
        return;
      }

      // Persist the message in MongoDB
      const msgDoc = {
        hiveId: toObjectId(workspaceId),
        userId: toObjectId(user.id),
        userName: user.name,
        userAvatar: user.image || "",
        text: payload.text,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection("chatmessages").insertOne(msgDoc);

      // Broadcast to room
      io.to(`workspace:${workspaceId}`).emit("chat:message", {
        id: result.insertedId.toString(),
        userId: user.id,
        userName: user.name,
        userImage: user.image || "",
        userAvatar: user.image || "",
        text: payload.text,
        timestamp: msgDoc.createdAt,
      });

    } catch (err: any) {
      console.error("[Chat Persistence Error]:", err.message);
    }
  });

  // -------------------------------------------------------------------------
  // Typing Indicators
  // -------------------------------------------------------------------------

  socket.on("typing:start", (payload: { workspaceId: string }) => {
    const workspaceId = payload.workspaceId || socket.data.workspaceId;
    if (!workspaceId) return;

    socket.to(`workspace:${workspaceId}`).emit("typing:update", {
      workspaceId,
      userId: user.id,
      name: user.name,
      isTyping: true
    });
  });

  socket.on("typing:stop", (payload: { workspaceId: string }) => {
    const workspaceId = payload.workspaceId || socket.data.workspaceId;
    if (!workspaceId) return;

    socket.to(`workspace:${workspaceId}`).emit("typing:update", {
      workspaceId,
      userId: user.id,
      name: user.name,
      isTyping: false
    });
  });

  // -------------------------------------------------------------------------
  // Collaborative Canvas Sync & Persistence
  // -------------------------------------------------------------------------

  // High-frequency dragging coordinates (event broadcasting only - no DB writes)
  socket.on("canvas:node-drag", (payload: { workspaceId: string; id: string; position: { x: number; y: number } }) => {
    const workspaceId = payload.workspaceId || socket.data.workspaceId;
    if (!workspaceId) return;

    socket.to(`workspace:${workspaceId}`).emit("canvas:node-drag", payload);
  });

  // Node locks (prevent simultaneous edit collisions)
  socket.on("canvas:node-lock", (payload: { workspaceId: string; id: string }) => {
    const workspaceId = payload.workspaceId || socket.data.workspaceId;
    if (!workspaceId) return;

    // Track lock
    if (!activeLocks.has(socket.id)) {
      activeLocks.set(socket.id, new Set());
    }
    const socketLocks = activeLocks.get(socket.id)!;
    let exists = false;
    for (const lock of socketLocks) {
      if (lock.workspaceId === workspaceId && lock.nodeId === payload.id) {
        exists = true;
        break;
      }
    }
    if (!exists) {
      socketLocks.add({ workspaceId, nodeId: payload.id });
    }

    socket.to(`workspace:${workspaceId}`).emit("canvas:node-lock", {
      ...payload,
      lockedBy: { id: user.id, name: user.name }
    });
  });

  socket.on("canvas:node-unlock", (payload: { workspaceId: string; id: string }) => {
    const workspaceId = payload.workspaceId || socket.data.workspaceId;
    if (!workspaceId) return;

    // Remove lock
    const socketLocks = activeLocks.get(socket.id);
    if (socketLocks) {
      for (const lock of socketLocks) {
        if (lock.workspaceId === workspaceId && lock.nodeId === payload.id) {
          socketLocks.delete(lock);
          break;
        }
      }
      if (socketLocks.size === 0) {
        activeLocks.delete(socket.id);
      }
    }

    socket.to(`workspace:${workspaceId}`).emit("canvas:node-unlock", payload);
  });

  // Drag stop (commits final coordinate alignment to database)
  socket.on("canvas:node-drag-stop", async (payload: { workspaceId: string; id: string; position: { x: number; y: number } }) => {
    const workspaceId = payload.workspaceId || socket.data.workspaceId;
    if (!workspaceId) return;

    // Broadcast to room
    socket.to(`workspace:${workspaceId}`).emit("canvas:node-drag-stop", payload);

    // Save final coordinates to MongoDB
    try {
      const db = await connectToDatabase();
      const previousNode = await db.collection("canvasnodes").findOne({
        hiveId: toObjectId(workspaceId),
        id: payload.id
      });

      await db.collection("canvasnodes").updateOne(
        { hiveId: toObjectId(workspaceId), id: payload.id },
        { $set: { position: payload.position, updatedAt: new Date() } }
      );

      const nextNode = await db.collection("canvasnodes").findOne({
        hiveId: toObjectId(workspaceId),
        id: payload.id
      });

      // Log transition event
      const mutationRes = await db.collection("graphmutationevents").insertOne({
        hiveId: toObjectId(workspaceId),
        eventType: "node_updated",
        entityId: payload.id,
        entityType: "node",
        actorId: toObjectId(user.id),
        actorName: user.name,
        previousState: previousNode,
        nextState: nextNode,
        timestamp: new Date()
      });

      await indexMutationEventInDb(db, {
        _id: mutationRes.insertedId,
        hiveId: toObjectId(workspaceId),
        eventType: "node_updated",
        entityId: payload.id,
        entityType: "node",
        actorName: user.name,
        timestamp: new Date()
      });

      if (nextNode) {
        await indexNodeInDb(db, workspaceId, nextNode);
      }

      // Invalidate Redis cache
      if (redisClient) {
        await redisClient.del(`hive:${workspaceId}:graph`);
      }

      console.log(`[Canvas DB] Updated node position ${payload.id} in workspace ${workspaceId}`);
    } catch (err) {
      console.error("[Canvas DB] Error updating node position:", err);
    }
  });

  // Node creation
  socket.on("canvas:node-create", async (payload: { workspaceId: string; node: any }) => {
    const workspaceId = payload.workspaceId || socket.data.workspaceId;
    if (!workspaceId) return;

    try {
      const db = await connectToDatabase();
      const nodeDoc = {
        id: payload.node.id,
        hiveId: toObjectId(workspaceId),
        type: payload.node.type || "customNode",
        category: payload.node.category,
        title: payload.node.title,
        description: payload.node.description || "",
        tags: payload.node.tags || [],
        createdBy: toObjectId(user.id),
        position: payload.node.position,
        data: payload.node.data || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection("canvasnodes").insertOne(nodeDoc);

      // Log transition event
      const mutationRes = await db.collection("graphmutationevents").insertOne({
        hiveId: toObjectId(workspaceId),
        eventType: "node_created",
        entityId: payload.node.id,
        entityType: "node",
        actorId: toObjectId(user.id),
        actorName: user.name,
        previousState: null,
        nextState: nodeDoc,
        timestamp: new Date()
      });

      await indexMutationEventInDb(db, {
        _id: mutationRes.insertedId,
        hiveId: toObjectId(workspaceId),
        eventType: "node_created",
        entityId: payload.node.id,
        entityType: "node",
        actorName: user.name,
        timestamp: new Date()
      });

      await indexNodeInDb(db, workspaceId, nodeDoc);

      // Invalidate Redis cache
      if (redisClient) {
        await redisClient.del(`hive:${workspaceId}:graph`);
      }

      console.log(`[Canvas DB] Created node ${payload.node.id} in workspace ${workspaceId}`);

      // Broadcast new node to all clients in the room
      io.to(`workspace:${workspaceId}`).emit("canvas:node-create", {
        workspaceId,
        node: {
          ...payload.node,
          createdBy: user.id,
          createdAt: nodeDoc.createdAt.toISOString(),
          updatedAt: nodeDoc.updatedAt.toISOString()
        }
      });
    } catch (err) {
      console.error("[Canvas DB] Error inserting node:", err);
      socket.emit("canvas:error", { message: "Failed to create node" });
    }
  });

  // Node editing
  socket.on("canvas:node-update", async (payload: { workspaceId: string; id: string; updates: any }) => {
    const workspaceId = payload.workspaceId || socket.data.workspaceId;
    if (!workspaceId) return;

    try {
      const db = await connectToDatabase();
      const previousNode = await db.collection("canvasnodes").findOne({
        hiveId: toObjectId(workspaceId),
        id: payload.id
      });

      const setFields: any = {
        updatedAt: new Date()
      };

      if (payload.updates.title !== undefined) setFields.title = payload.updates.title;
      if (payload.updates.description !== undefined) setFields.description = payload.updates.description;
      if (payload.updates.tags !== undefined) setFields.tags = payload.updates.tags;
      if (payload.updates.category !== undefined) setFields.category = payload.updates.category;
      if (payload.updates.data !== undefined) setFields.data = payload.updates.data;
      if (payload.updates.position !== undefined) setFields.position = payload.updates.position;

      await db.collection("canvasnodes").updateOne(
        { hiveId: toObjectId(workspaceId), id: payload.id },
        { $set: setFields }
      );

      const nextNode = await db.collection("canvasnodes").findOne({
        hiveId: toObjectId(workspaceId),
        id: payload.id
      });

      // Log transition event
      const mutationRes = await db.collection("graphmutationevents").insertOne({
        hiveId: toObjectId(workspaceId),
        eventType: "node_updated",
        entityId: payload.id,
        entityType: "node",
        actorId: toObjectId(user.id),
        actorName: user.name,
        previousState: previousNode,
        nextState: nextNode,
        timestamp: new Date()
      });

      await indexMutationEventInDb(db, {
        _id: mutationRes.insertedId,
        hiveId: toObjectId(workspaceId),
        eventType: "node_updated",
        entityId: payload.id,
        entityType: "node",
        actorName: user.name,
        timestamp: new Date()
      });

      if (nextNode) {
        await indexNodeInDb(db, workspaceId, nextNode);
      }

      // Invalidate Redis cache
      if (redisClient) {
        await redisClient.del(`hive:${workspaceId}:graph`);
      }

      console.log(`[Canvas DB] Updated node ${payload.id} in workspace ${workspaceId}`);

      // Broadcast changes to everyone
      io.to(`workspace:${workspaceId}`).emit("canvas:node-update", payload);
    } catch (err) {
      console.error("[Canvas DB] Error updating node:", err);
      socket.emit("canvas:error", { message: "Failed to update node" });
    }
  });

  // Node deletion (and cascade deletion of connected edges)
  socket.on("canvas:node-delete", async (payload: { workspaceId: string; id: string }) => {
    const workspaceId = payload.workspaceId || socket.data.workspaceId;
    if (!workspaceId) return;

    try {
      const db = await connectToDatabase();
      const previousNode = await db.collection("canvasnodes").findOne({
        hiveId: toObjectId(workspaceId),
        id: payload.id
      });

      const connectedEdges = await db.collection("canvasedges").find({
        hiveId: toObjectId(workspaceId),
        $or: [{ source: payload.id }, { target: payload.id }]
      }).toArray();
      
      // 1. Delete node
      const nodeResult = await db.collection("canvasnodes").deleteOne({
        hiveId: toObjectId(workspaceId),
        id: payload.id
      });

      // 2. Cascade delete connected edges
      const edgeResult = await db.collection("canvasedges").deleteMany({
        hiveId: toObjectId(workspaceId),
        $or: [{ source: payload.id }, { target: payload.id }]
      });

      // Log node deletion
      if (previousNode) {
        const mutationRes = await db.collection("graphmutationevents").insertOne({
          hiveId: toObjectId(workspaceId),
          eventType: "node_deleted",
          entityId: payload.id,
          entityType: "node",
          actorId: toObjectId(user.id),
          actorName: user.name,
          previousState: previousNode,
          nextState: null,
          timestamp: new Date()
        });

        await indexMutationEventInDb(db, {
          _id: mutationRes.insertedId,
          hiveId: toObjectId(workspaceId),
          eventType: "node_deleted",
          entityId: payload.id,
          entityType: "node",
          actorName: user.name,
          timestamp: new Date()
        });

        await db.collection("knowledgeindices").deleteOne({ entityId: payload.id });
      }

      // Log edge deletions
      for (const edge of connectedEdges) {
        const mutationRes = await db.collection("graphmutationevents").insertOne({
          hiveId: toObjectId(workspaceId),
          eventType: "edge_deleted",
          entityId: edge.id,
          entityType: "edge",
          actorId: toObjectId(user.id),
          actorName: user.name,
          previousState: edge,
          nextState: null,
          timestamp: new Date()
        });

        await indexMutationEventInDb(db, {
          _id: mutationRes.insertedId,
          hiveId: toObjectId(workspaceId),
          eventType: "edge_deleted",
          entityId: edge.id,
          entityType: "edge",
          actorName: user.name,
          timestamp: new Date()
        });
      }

      // Invalidate Redis cache
      if (redisClient) {
        await redisClient.del(`hive:${workspaceId}:graph`);
      }

      console.log(`[Canvas DB] Deleted node ${payload.id} (${nodeResult.deletedCount}) and connected edges (${edgeResult.deletedCount}) in workspace ${workspaceId}`);

      // Broadcast deletion
      io.to(`workspace:${workspaceId}`).emit("canvas:node-delete", payload);
    } catch (err) {
      console.error("[Canvas DB] Error deleting node:", err);
      socket.emit("canvas:error", { message: "Failed to delete node" });
    }
  });

  // Edge creation
  socket.on("canvas:edge-create", async (payload: { workspaceId: string; edge: any }) => {
    const workspaceId = payload.workspaceId || socket.data.workspaceId;
    if (!workspaceId) return;

    try {
      const db = await connectToDatabase();
      const edgeDoc = {
        id: payload.edge.id,
        hiveId: toObjectId(workspaceId),
        source: payload.edge.source,
        target: payload.edge.target,
        type: payload.edge.type || "smoothstep",
        relationType: payload.edge.relationType || "relates_to",
        data: payload.edge.data || {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection("canvasedges").insertOne(edgeDoc);

      // Log transition event
      await db.collection("graphmutationevents").insertOne({
        hiveId: toObjectId(workspaceId),
        eventType: "edge_created",
        entityId: payload.edge.id,
        entityType: "edge",
        actorId: toObjectId(user.id),
        actorName: user.name,
        previousState: null,
        nextState: edgeDoc,
        timestamp: new Date()
      });

      // Invalidate Redis cache
      if (redisClient) {
        await redisClient.del(`hive:${workspaceId}:graph`);
      }

      console.log(`[Canvas DB] Created connection edge ${payload.edge.id} in workspace ${workspaceId}`);

      // Broadcast to room
      io.to(`workspace:${workspaceId}`).emit("canvas:edge-create", payload);
    } catch (err) {
      console.error("[Canvas DB] Error creating edge:", err);
      socket.emit("canvas:error", { message: "Failed to create connection" });
    }
  });

  // Edge deletion
  socket.on("canvas:edge-delete", async (payload: { workspaceId: string; id: string }) => {
    const workspaceId = payload.workspaceId || socket.data.workspaceId;
    if (!workspaceId) return;

    try {
      const db = await connectToDatabase();
      const previousEdge = await db.collection("canvasedges").findOne({
        hiveId: toObjectId(workspaceId),
        id: payload.id
      });

      await db.collection("canvasedges").deleteOne({
        hiveId: toObjectId(workspaceId),
        id: payload.id
      });

      // Log transition event
      if (previousEdge) {
        await db.collection("graphmutationevents").insertOne({
          hiveId: toObjectId(workspaceId),
          eventType: "edge_deleted",
          entityId: payload.id,
          entityType: "edge",
          actorId: toObjectId(user.id),
          actorName: user.name,
          previousState: previousEdge,
          nextState: null,
          timestamp: new Date()
        });
      }

      // Invalidate Redis cache
      if (redisClient) {
        await redisClient.del(`hive:${workspaceId}:graph`);
      }

      console.log(`[Canvas DB] Deleted connection edge ${payload.id} in workspace ${workspaceId}`);

      // Broadcast to room
      io.to(`workspace:${workspaceId}`).emit("canvas:edge-delete", payload);
    } catch (err) {
      console.error("[Canvas DB] Error deleting edge:", err);
      socket.emit("canvas:error", { message: "Failed to delete connection" });
    }
  });

  // Edge relation type updates
  socket.on("canvas:edge-update-relation", async (payload: { workspaceId: string; id: string; relationType: string }) => {
    const workspaceId = payload.workspaceId || socket.data.workspaceId;
    if (!workspaceId) return;

    try {
      const db = await connectToDatabase();
      const previousEdge = await db.collection("canvasedges").findOne({
        hiveId: toObjectId(workspaceId),
        id: payload.id
      });

      await db.collection("canvasedges").updateOne(
        { hiveId: toObjectId(workspaceId), id: payload.id },
        { $set: { relationType: payload.relationType, updatedAt: new Date() } }
      );

      const nextEdge = await db.collection("canvasedges").findOne({
        hiveId: toObjectId(workspaceId),
        id: payload.id
      });

      // Log transition event
      await db.collection("graphmutationevents").insertOne({
        hiveId: toObjectId(workspaceId),
        eventType: "edge_updated",
        entityId: payload.id,
        entityType: "edge",
        actorId: toObjectId(user.id),
        actorName: user.name,
        previousState: previousEdge,
        nextState: nextEdge,
        timestamp: new Date()
      });

      // Invalidate Redis cache
      if (redisClient) {
        await redisClient.del(`hive:${workspaceId}:graph`);
      }

      console.log(`[Canvas DB] Updated connection edge relationType ${payload.id} to ${payload.relationType} in workspace ${workspaceId}`);

      // Broadcast to room
      io.to(`workspace:${workspaceId}`).emit("canvas:edge-update-relation", payload);
    } catch (err) {
      console.error("[Canvas DB] Error updating edge relationType:", err);
      socket.emit("canvas:error", { message: "Failed to update edge relationship" });
    }
  });

  // -------------------------------------------------------------------------
  // Document Collaboration Sync & Presence
  // -------------------------------------------------------------------------

  socket.on("document:join", async (payload: { workspaceId: string; docId: string }) => {
    const { workspaceId, docId } = payload;
    if (!workspaceId || !docId) return;

    console.log(`[Document Presence] Socket ${socket.id} (${user.name}) joining document: ${docId}`);

    // If socket was in another document room, leave it
    if (socket.data.docId && socket.data.docId !== docId) {
      const prevDocId = socket.data.docId;
      const prevWorkspace = socket.data.workspaceId || workspaceId;
      socket.leave(`workspace:${prevWorkspace}:document:${prevDocId}`);
      socket.data.docId = undefined;
      await broadcastDocumentPresence(prevWorkspace, prevDocId);
    }

    const docRoomName = `workspace:${workspaceId}:document:${docId}`;
    socket.join(docRoomName);
    socket.data.docId = docId;
    socket.data.workspaceId = workspaceId;

    await broadcastDocumentPresence(workspaceId, docId);
  });

  socket.on("document:leave", async () => {
    const docId = socket.data.docId;
    const workspaceId = socket.data.workspaceId;
    if (!docId || !workspaceId) return;

    console.log(`[Document Presence] Socket ${socket.id} (${user.name}) leaving document: ${docId}`);
    socket.leave(`workspace:${workspaceId}:document:${docId}`);
    socket.data.docId = undefined;

    await broadcastDocumentPresence(workspaceId, docId);
  });

  socket.on("document:typing-start", (payload: { workspaceId: string; docId: string }) => {
    const workspaceId = payload.workspaceId || socket.data.workspaceId;
    const docId = payload.docId || socket.data.docId;
    if (!workspaceId || !docId) return;

    socket.to(`workspace:${workspaceId}:document:${docId}`).emit("document:typing-update", {
      workspaceId,
      docId,
      userId: user.id,
      name: user.name,
      isTyping: true
    });
  });

  socket.on("document:typing-stop", (payload: { workspaceId: string; docId: string }) => {
    const workspaceId = payload.workspaceId || socket.data.workspaceId;
    const docId = payload.docId || socket.data.docId;
    if (!workspaceId || !docId) return;

    socket.to(`workspace:${workspaceId}:document:${docId}`).emit("document:typing-update", {
      workspaceId,
      docId,
      userId: user.id,
      name: user.name,
      isTyping: false
    });
  });

  socket.on("document:save-notification", (payload: { workspaceId: string; docId: string; document: any }) => {
    const workspaceId = payload.workspaceId || socket.data.workspaceId;
    const docId = payload.docId || socket.data.docId;
    if (!workspaceId || !docId) return;

    // Broadcast reload notification to all other clients in the document room
    socket.to(`workspace:${workspaceId}:document:${docId}`).emit("document:reload", {
      workspaceId,
      docId,
      document: payload.document
    });
  });

  // -------------------------------------------------------------------------
  // Disconnect Handlers
  // -------------------------------------------------------------------------

  socket.on("disconnecting", async () => {
    const workspaceId = socket.data.workspaceId;
    const docId = socket.data.docId;

    // Release locks automatically on disconnect
    const socketLocks = activeLocks.get(socket.id);
    if (socketLocks) {
      console.log(`[Presence] Socket ${socket.id} disconnecting. Automatically releasing ${socketLocks.size} locks.`);
      for (const lock of socketLocks) {
        io.to(`workspace:${lock.workspaceId}`).emit("canvas:node-unlock", {
          workspaceId: lock.workspaceId,
          id: lock.nodeId
        });
      }
      activeLocks.delete(socket.id);
    }

    if (workspaceId) {
      console.log(`[Presence] Socket ${socket.id} disconnecting from workspace ${workspaceId}`);
      const roomName = `workspace:${workspaceId}`;
      const sockets = await io.in(roomName).fetchSockets();
      
      const userMap = new Map<string, AuthenticatedUser>();
      for (const s of sockets) {
        if (s.id !== socket.id && s.data.user) {
          userMap.set((s.data.user as AuthenticatedUser).id, s.data.user as AuthenticatedUser);
        }
      }
      const activeMembers = Array.from(userMap.values());
      
      socket.to(roomName).emit("workspace:presence", {
        workspaceId,
        members: activeMembers
      });
    }

    if (workspaceId && docId) {
      console.log(`[Document Presence] Socket ${socket.id} disconnecting from document ${docId}`);
      const docRoomName = `workspace:${workspaceId}:document:${docId}`;
      socket.leave(docRoomName);
      
      const sockets = await io.in(docRoomName).fetchSockets();
      const userMap = new Map<string, AuthenticatedUser>();
      for (const s of sockets) {
        if (s.id !== socket.id && s.data.user) {
          userMap.set((s.data.user as AuthenticatedUser).id, s.data.user as AuthenticatedUser);
        }
      }
      const activeMembers = Array.from(userMap.values());

      socket.to(docRoomName).emit("document:presence", {
        workspaceId,
        docId,
        members: activeMembers
      });
    }
  });

  socket.on("disconnect", async () => {
    console.log(`[Presence] Socket ${socket.id} (${user.name}) disconnected.`);
    if (redisClient) {
      redisClient.decr(`presence:connections:${userId}`).then((count) => {
        if (count <= 0) {
          io.emit("user:status", { userId, status: "offline" });
          redisClient.del(`presence:connections:${userId}`);
        }
      }).catch(err => console.error("[Presence Redis] Error decrementing connections:", err));
    } else {
      io.emit("user:status", { userId, status: "offline" });
    }
  });
}
