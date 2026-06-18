import { auth } from "@/lib/auth";
import { getCanvasElements } from "@/server/actions/canvas";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import CanvasNode from "@/server/models/CanvasNode";
import CanvasEdge from "@/server/models/CanvasEdge";
import redis from "@/lib/redis";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{ hiveId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { hiveId } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", data: null },
        { status: 401 }
      );
    }

    const canvas = await getCanvasElements(hiveId);

    return NextResponse.json({ data: canvas, error: null }, { status: 200 });
  } catch (err) {
    console.error(`[GET /api/hives/:hiveId/canvas]`, err);
    return NextResponse.json(
      { error: "Internal server error", data: null },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { hiveId } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();
    const { action, node, id, updates } = body;

    if (action === "create_node") {
      if (!node) {
        return NextResponse.json({ error: "Node payload is required" }, { status: 400 });
      }

      const nodeDoc = await CanvasNode.create({
        id: node.id,
        hiveId: new mongoose.Types.ObjectId(hiveId),
        type: node.type || "customNode",
        category: node.category,
        title: node.title,
        description: node.description || "",
        tags: node.tags || [],
        createdBy: new mongoose.Types.ObjectId(session.user.id),
        position: node.position || { x: 0, y: 0 },
        data: node.data || {}
      });

      // Update Search Index
      await mongoose.connection.db?.collection("knowledgeindices").updateOne(
        { entityId: node.id },
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

      // Publish to Redis
      if (redis) {
        await redis.del(`hive:${hiveId}:graph`);
        await redis.publish("hiveos:canvas", JSON.stringify({
          workspaceId: hiveId,
          event: "canvas:node-create",
          payload: { workspaceId: hiveId, node: nodeDoc }
        }));
      }

      return NextResponse.json({ success: true, data: nodeDoc });
    }

    if (action === "update_node") {
      if (!id || !updates) {
        return NextResponse.json({ error: "id and updates are required" }, { status: 400 });
      }

      const prevNode = await CanvasNode.findOne({ hiveId: new mongoose.Types.ObjectId(hiveId), id });
      if (!prevNode) {
        return NextResponse.json({ error: "Node not found" }, { status: 404 });
      }

      const setFields: any = { updatedAt: new Date() };
      if (updates.title !== undefined) setFields.title = updates.title;
      if (updates.description !== undefined) setFields.description = updates.description;
      if (updates.tags !== undefined) setFields.tags = updates.tags;
      if (updates.category !== undefined) setFields.category = updates.category;
      if (updates.data !== undefined) setFields.data = updates.data;
      if (updates.position !== undefined) setFields.position = updates.position;

      const updatedNode = await CanvasNode.findOneAndUpdate(
        { hiveId: new mongoose.Types.ObjectId(hiveId), id },
        { $set: setFields },
        { new: true }
      );

      // Log transition event
      await mongoose.connection.db?.collection("graphmutationevents").insertOne({
        hiveId: new mongoose.Types.ObjectId(hiveId),
        eventType: "node_updated",
        entityId: id,
        entityType: "node",
        actorId: new mongoose.Types.ObjectId(session.user.id),
        actorName: session.user.name,
        previousState: prevNode,
        nextState: updatedNode,
        timestamp: new Date()
      });

      // Update Search Index
      if (updatedNode) {
        await mongoose.connection.db?.collection("knowledgeindices").updateOne(
          { entityId: id },
          {
            $set: {
              hiveId: new mongoose.Types.ObjectId(hiveId),
              entityType: "node",
              title: updatedNode.title,
              content: `${updatedNode.description || ""} ${updatedNode.category || ""}`.trim(),
              tags: updatedNode.tags || [],
              status: updatedNode.data?.status || null,
              metadata: {
                category: updatedNode.category,
                priority: updatedNode.data?.priority || null,
                createdBy: updatedNode.createdBy ? updatedNode.createdBy.toString() : null
              },
              sourceUpdatedAt: updatedNode.updatedAt || new Date(),
              updatedAt: new Date()
            }
          },
          { upsert: true }
        );
      }

      // Publish to Redis
      if (redis) {
        await redis.del(`hive:${hiveId}:graph`);
        await redis.publish("hiveos:canvas", JSON.stringify({
          workspaceId: hiveId,
          event: "canvas:node-update",
          payload: { workspaceId: hiveId, id, updates }
        }));
      }

      return NextResponse.json({ success: true, data: updatedNode });
    }

    if (action === "delete_node") {
      if (!id) {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
      }

      const prevNode = await CanvasNode.findOne({ hiveId: new mongoose.Types.ObjectId(hiveId), id });
      if (!prevNode) {
        return NextResponse.json({ error: "Node not found" }, { status: 404 });
      }

      await CanvasNode.deleteOne({ hiveId: new mongoose.Types.ObjectId(hiveId), id });
      await CanvasEdge.deleteMany({ hiveId: new mongoose.Types.ObjectId(hiveId), $or: [{ source: id }, { target: id }] });
      await mongoose.connection.db?.collection("knowledgeindices").deleteOne({ entityId: id });

      // Log transition event
      await mongoose.connection.db?.collection("graphmutationevents").insertOne({
        hiveId: new mongoose.Types.ObjectId(hiveId),
        eventType: "node_deleted",
        entityId: id,
        entityType: "node",
        actorId: new mongoose.Types.ObjectId(session.user.id),
        actorName: session.user.name,
        previousState: prevNode,
        nextState: null,
        timestamp: new Date()
      });

      // Publish to Redis
      if (redis) {
        await redis.del(`hive:${hiveId}:graph`);
        await redis.publish("hiveos:canvas", JSON.stringify({
          workspaceId: hiveId,
          event: "canvas:node-delete",
          payload: { workspaceId: hiveId, id }
        }));
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (err) {
    console.error(`[POST /api/hives/:hiveId/canvas]`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
