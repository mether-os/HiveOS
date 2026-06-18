import connectDB from "@/lib/db";
import CanvasNode from "@/server/models/CanvasNode";
import CanvasEdge from "@/server/models/CanvasEdge";
import mongoose from "mongoose";

function toObjectId(id: string): mongoose.Types.ObjectId | null {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
}

export interface SerializedCanvasNode {
  id: string;
  hiveId: string;
  type: string;
  category: string;
  title: string;
  description: string;
  tags: string[];
  createdBy: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedCanvasEdge {
  id: string;
  hiveId: string;
  source: string;
  target: string;
  type: string;
  data?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

/**
 * getCanvasElements — Fetch all nodes and edges for a given workspace hive.
 */
export async function getCanvasElements(hiveId: string): Promise<{
  nodes: SerializedCanvasNode[];
  edges: SerializedCanvasEdge[];
}> {
  await connectDB();

  const oid = toObjectId(hiveId);
  if (!oid) {
    throw new Error(`Invalid hiveId format: ${hiveId}`);
  }

  const nodes = await CanvasNode.find({ hiveId: oid }).lean().exec();
  const edges = await CanvasEdge.find({ hiveId: oid }).lean().exec();

  const serializedNodes = nodes.map((node) => ({
    id: node.id || "",
    hiveId: node.hiveId ? node.hiveId.toString() : "",
    type: node.type || "default",
    category: node.category || "",
    title: node.title || "",
    description: node.description || "",
    tags: node.tags || [],
    createdBy: node.createdBy ? node.createdBy.toString() : "",
    position: node.position || { x: 0, y: 0 },
    data: node.data || {},
    createdAt: node.createdAt ? node.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: node.updatedAt ? node.updatedAt.toISOString() : new Date().toISOString(),
  }));

  const serializedEdges = edges.map((edge) => ({
    id: edge.id || "",
    hiveId: edge.hiveId ? edge.hiveId.toString() : "",
    source: edge.source || "",
    target: edge.target || "",
    type: edge.type || "default",
    data: edge.data || {},
    createdAt: edge.createdAt ? edge.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: edge.updatedAt ? edge.updatedAt.toISOString() : new Date().toISOString(),
  }));

  return { nodes: serializedNodes, edges: serializedEdges };
}
