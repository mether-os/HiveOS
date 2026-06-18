import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import { headers } from "next/headers";
import mongoose from "mongoose";
import Hive from "@/server/models/Hive";
import CanvasNode from "@/server/models/CanvasNode";
import CanvasEdge from "@/server/models/CanvasEdge";
import Document from "@/server/models/Document";
import Activity from "@/server/models/Activity";
import redis from "@/lib/redis";

type RouteContext = { params: Promise<{ hiveId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { hiveId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(hiveId)) {
      return NextResponse.json({ error: "Invalid hive ID" }, { status: 400 });
    }

    await connectDB();

    // Verify workspace ownership
    const hive = await Hive.findOne({
      _id: new mongoose.Types.ObjectId(hiveId),
      ownerId: new mongoose.Types.ObjectId(session.user.id),
    });

    if (!hive) {
      return NextResponse.json({ error: "Hive not found or unauthorized" }, { status: 404 });
    }

    const payload = await request.json();
    const { nodes = [], edges = [], documents = [] } = payload;

    const auditTrail: string[] = [];

    // 1. Process Nodes modifications
    for (const node of nodes) {
      if (node.action === "create") {
        const nodeId = node.id || `node-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;
        const position = node.position || {
          x: 100 + Math.random() * 400,
          y: 100 + Math.random() * 400
        };

        const nodeDoc = await CanvasNode.findOneAndUpdate(
          { hiveId: new mongoose.Types.ObjectId(hiveId), id: nodeId },
          {
            $set: {
              type: "customNode",
              category: node.category || "Feature",
              title: node.title,
              description: node.description || "",
              tags: node.tags || [],
              position,
              createdBy: new mongoose.Types.ObjectId(session.user.id),
              data: node.data || {}
            }
          },
          { upsert: true, new: true }
        );

        auditTrail.push(`Created ${node.category} "${node.title}"`);

        // Index in Search
        await mongoose.connection.db?.collection("knowledgeindices").updateOne(
          { entityId: nodeId },
          {
            $set: {
              hiveId: new mongoose.Types.ObjectId(hiveId),
              entityType: "node",
              title: node.title,
              content: `${node.description || ""} ${node.category || ""}`.trim(),
              tags: node.tags || [],
              status: node.data?.status || null,
              metadata: {
                category: node.category,
                priority: node.data?.priority || null,
                createdBy: session.user.id
              },
              sourceUpdatedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            }
          },
          { upsert: true }
        );

        // Redis publish
        if (redis) {
          await redis.publish("hiveos:canvas", JSON.stringify({
            workspaceId: hiveId,
            event: "canvas:node-create",
            payload: { workspaceId: hiveId, node: nodeDoc }
          }));
        }
      } else if (node.action === "update") {
        const existingNode = await CanvasNode.findOne({ hiveId: new mongoose.Types.ObjectId(hiveId), id: node.id });
        if (existingNode) {
          const updates: any = {};
          if (node.title !== undefined) updates.title = node.title;
          if (node.description !== undefined) updates.description = node.description;
          if (node.category !== undefined) updates.category = node.category;
          if (node.tags !== undefined) updates.tags = node.tags;
          if (node.data !== undefined) updates.data = { ...existingNode.data, ...node.data };
          if (node.position !== undefined) updates.position = node.position;

          const updatedNode = await CanvasNode.findOneAndUpdate(
            { hiveId: new mongoose.Types.ObjectId(hiveId), id: node.id },
            { $set: updates },
            { new: true }
          );

          auditTrail.push(`Updated ${updatedNode?.category || "Node"} "${updatedNode?.title}"`);

          // Index in Search
          await mongoose.connection.db?.collection("knowledgeindices").updateOne(
            { entityId: node.id },
            {
              $set: {
                hiveId: new mongoose.Types.ObjectId(hiveId),
                entityType: "node",
                title: node.title || existingNode.title,
                content: `${node.description || existingNode.description || ""} ${node.category || existingNode.category || ""}`.trim(),
                tags: node.tags || existingNode.tags,
                status: node.data?.status || existingNode.data?.status || null,
                metadata: {
                  category: node.category || existingNode.category,
                  priority: node.data?.priority || existingNode.data?.priority || null,
                  createdBy: existingNode.createdBy ? existingNode.createdBy.toString() : session.user.id
                },
                sourceUpdatedAt: new Date(),
                updatedAt: new Date()
              }
            },
            { upsert: true }
          );

          if (redis) {
            await redis.publish("hiveos:canvas", JSON.stringify({
              workspaceId: hiveId,
              event: "canvas:node-update",
              payload: { workspaceId: hiveId, id: node.id, updates }
            }));
          }
        }
      } else if (node.action === "delete") {
        const existingNode = await CanvasNode.findOne({ hiveId: new mongoose.Types.ObjectId(hiveId), id: node.id });
        if (existingNode) {
          await CanvasNode.deleteOne({ hiveId: new mongoose.Types.ObjectId(hiveId), id: node.id });
          await CanvasEdge.deleteMany({ hiveId: new mongoose.Types.ObjectId(hiveId), $or: [{ source: node.id }, { target: node.id }] });
          await mongoose.connection.db?.collection("knowledgeindices").deleteOne({ entityId: node.id });

          auditTrail.push(`Deleted ${existingNode.category} "${existingNode.title}"`);

          if (redis) {
            await redis.publish("hiveos:canvas", JSON.stringify({
              workspaceId: hiveId,
              event: "canvas:node-delete",
              payload: { workspaceId: hiveId, id: node.id }
            }));
          }
        }
      }
    }

    // 2. Process Edges modifications
    for (const edge of edges) {
      if (edge.action === "create") {
        const edgeId = edge.id || `edge-${edge.source}-${edge.target}-${Date.now().toString(36)}`;
        const edgeDoc = await CanvasEdge.findOneAndUpdate(
          { hiveId: new mongoose.Types.ObjectId(hiveId), id: edgeId },
          {
            $set: {
              source: edge.source,
              target: edge.target,
              type: "smoothstep",
              relationType: edge.relationType || "relates_to",
              data: edge.data || {}
            }
          },
          { upsert: true, new: true }
        );

        auditTrail.push(`Connected ${edge.source} to ${edge.target}`);

        if (redis) {
          await redis.publish("hiveos:canvas", JSON.stringify({
            workspaceId: hiveId,
            event: "canvas:edge-create",
            payload: { workspaceId: hiveId, edge: edgeDoc }
          }));
        }
      } else if (edge.action === "delete") {
        const query: any = { hiveId: new mongoose.Types.ObjectId(hiveId) };
        if (edge.id) {
          query.id = edge.id;
        } else {
          query.source = edge.source;
          query.target = edge.target;
        }

        const existingEdge = await CanvasEdge.findOne(query);
        if (existingEdge) {
          await CanvasEdge.deleteOne(query);
          auditTrail.push(`Removed connection between ${existingEdge.source} and ${existingEdge.target}`);

          if (redis) {
            await redis.publish("hiveos:canvas", JSON.stringify({
              workspaceId: hiveId,
              event: "canvas:edge-delete",
              payload: { workspaceId: hiveId, id: existingEdge.id }
            }));
          }
        }
      }
    }

    // 3. Process Documents modifications
    for (const doc of documents) {
      if (doc.action === "create" || doc.action === "update") {
        const docObj = await Document.findOneAndUpdate(
          { hiveId: new mongoose.Types.ObjectId(hiveId), nodeId: doc.linkedNodeId },
          {
            $set: {
              title: doc.title,
              type: doc.type || "prd",
              content: doc.content,
              updatedBy: new mongoose.Types.ObjectId(session.user.id)
            },
            $setOnInsert: {
              status: "draft",
              tags: ["spec", doc.type || "prd"],
              createdBy: new mongoose.Types.ObjectId(session.user.id)
            }
          },
          { upsert: true, new: true }
        );

        auditTrail.push(`${doc.action === "create" ? "Drafted" : "Updated"} specification "${doc.title}"`);

        // Index document in Search
        await mongoose.connection.db?.collection("knowledgeindices").updateOne(
          { entityId: docObj._id.toString() },
          {
            $set: {
              hiveId: new mongoose.Types.ObjectId(hiveId),
              entityType: "document",
              title: docObj.title,
              content: docObj.content,
              tags: docObj.tags,
              status: docObj.status,
              metadata: {
                type: docObj.type,
                createdBy: session.user.id
              },
              sourceUpdatedAt: docObj.updatedAt,
              updatedAt: new Date()
            }
          },
          { upsert: true }
        );
      }
    }

    // Clear caches
    if (redis) {
      await redis.del(`hive:${hiveId}:graph`);
    }

    // Save activity feed entry
    if (auditTrail.length > 0) {
      const activityMsg = `HiveMind autonomously modified project structure: ${auditTrail.join("; ")}.`;
      const activity = await Activity.create({
        hiveId: new mongoose.Types.ObjectId(hiveId),
        type: "system",
        title: "Workspace Restructured",
        description: activityMsg,
        actorName: "HiveMind",
        timestamp: new Date()
      });

      if (redis) {
        await redis.publish("hiveos:activity", JSON.stringify({
          hiveId,
          activity: {
            type: "system",
            title: "Workspace Restructured",
            description: activityMsg,
            actorName: "HiveMind",
            timestamp: activity.timestamp.toISOString()
          }
        }));
      }
    }

    return NextResponse.json({ success: true, audit: auditTrail });

  } catch (err: any) {
    console.error("[POST /api/hives/[hiveId]/canvas/modify]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
