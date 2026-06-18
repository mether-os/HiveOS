import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Hive from "@/server/models/Hive";
import Document from "@/server/models/Document";
import CanvasNode from "@/server/models/CanvasNode";
import CanvasEdge from "@/server/models/CanvasEdge";
import DocumentKnowledgeEvent from "@/server/models/DocumentKnowledgeEvent";
import { invalidateGraphCache } from "@/server/utils/graphEngine";
import { indexDocument, indexNode } from "@/server/utils/knowledgeIndexService";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{ hiveId: string }>;
}

// Map document type to canvas edge relationType
function getSemanticRelation(docType: string): "depends_on" | "implements" | "relates_to" | "blocks" | "documents" | "owns" | "uses" | "generates" {
  switch (docType) {
    case "prd":
      return "implements";
    case "trd":
      return "uses";
    case "research":
      return "relates_to";
    case "meeting":
      return "generates";
    case "architecture":
      return "documents";
    default:
      return "relates_to";
  }
}

// GET: List all documents in a Hive
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { hiveId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized", data: null }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(hiveId)) {
      return NextResponse.json({ error: "Invalid Hive ID", data: null }, { status: 400 });
    }

    await connectDB();

    // Verify membership/ownership of Hive
    const hive = await Hive.findOne({
      _id: new mongoose.Types.ObjectId(hiveId),
      ownerId: new mongoose.Types.ObjectId(session.user.id),
    });

    if (!hive) {
      return NextResponse.json({ error: "Hive not found or unauthorized", data: null }, { status: 404 });
    }

    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    const tag = url.searchParams.get("tag");

    const query: any = { hiveId: new mongoose.Types.ObjectId(hiveId) };
    if (type) query.type = type;
    if (status) query.status = status;
    if (tag) query.tags = tag;

    const docs = await Document.find(query).sort({ updatedAt: -1 }).exec();

    return NextResponse.json({ data: docs, error: null }, { status: 200 });
  } catch (err: any) {
    console.error("[GET /api/hives/[hiveId]/documents]", err);
    return NextResponse.json({ error: "Internal server error", message: err.message }, { status: 500 });
  }
}

// POST: Create a new document + place matching CanvasNode with smart placement
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { hiveId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized", data: null }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(hiveId)) {
      return NextResponse.json({ error: "Invalid Hive ID", data: null }, { status: 400 });
    }

    const body = await request.json();
    const { title, type, tags = [], linkedNodeId } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    await connectDB();

    // Verify ownership
    const hive = await Hive.findOne({
      _id: new mongoose.Types.ObjectId(hiveId),
      ownerId: new mongoose.Types.ObjectId(session.user.id),
    });

    if (!hive) {
      return NextResponse.json({ error: "Hive not found or unauthorized", data: null }, { status: 404 });
    }

    // 1. Calculate smart placement coordinates on canvas to prevent overlap
    let position = { x: -300, y: -300 }; // Default cluster coordinate start
    const allNodes = await CanvasNode.find({ hiveId: new mongoose.Types.ObjectId(hiveId) }).exec();

    if (linkedNodeId) {
      // Place near the linked target node
      const targetNode = allNodes.find((n) => n.id === linkedNodeId);
      if (targetNode) {
        position = {
          x: targetNode.position.x + 180,
          y: targetNode.position.y + 40,
        };
      }
    } else {
      // Grid search collision-avoidance in the "Documents Cluster" region
      // Finds the first free slot at offsets of 150px
      const minDistance = 120;
      let slotFound = false;
      
      for (let gridX = -600; gridX <= 0; gridX += 160) {
        for (let gridY = -600; gridY <= 0; gridY += 120) {
          // Check distance to all existing nodes
          const hasCollision = allNodes.some((node) => {
            const dx = node.position.x - gridX;
            const dy = node.position.y - gridY;
            return Math.sqrt(dx * dx + dy * dy) < minDistance;
          });

          if (!hasCollision) {
            position = { x: gridX, y: gridY };
            slotFound = true;
            break;
          }
        }
        if (slotFound) break;
      }
    }

    // 2. Create the CanvasNode
    const canvasNodeId = `node-doc-${Date.now().toString(36)}`;
    const canvasNodeDoc = await CanvasNode.create({
      id: canvasNodeId,
      hiveId: new mongoose.Types.ObjectId(hiveId),
      type: "customNode",
      category: "Document",
      title: title.trim(),
      description: `Format: ${type.toUpperCase()}`,
      position,
      tags: tags.map((t: string) => t.trim()).filter(Boolean),
      createdBy: new mongoose.Types.ObjectId(session.user.id),
      data: {
        status: "Todo",
        priority: "Low",
      },
    });

    // 3. Create the Document
    const documentDoc = await Document.create({
      hiveId: new mongoose.Types.ObjectId(hiveId),
      nodeId: canvasNodeId,
      title: title.trim(),
      type: type || "markdown",
      content: "",
      tags: tags.map((t: string) => t.trim()).filter(Boolean),
      status: "draft",
      createdBy: new mongoose.Types.ObjectId(session.user.id),
      updatedBy: new mongoose.Types.ObjectId(session.user.id),
    });

    // 4. Create the Semantic Edge (if linked to another node during creation)
    if (linkedNodeId) {
      const edgeId = `edge-doc-${canvasNodeId}-${linkedNodeId}-${Date.now().toString(36)}`;
      const relationType = getSemanticRelation(type);

      await CanvasEdge.create({
        id: edgeId,
        hiveId: new mongoose.Types.ObjectId(hiveId),
        source: canvasNodeId,
        target: linkedNodeId,
        type: "smoothstep",
        relationType,
        data: {},
      });

      // Log link event
      await DocumentKnowledgeEvent.create({
        hiveId: new mongoose.Types.ObjectId(hiveId),
        documentId: documentDoc._id,
        eventType: "DocumentLinked",
        actorId: new mongoose.Types.ObjectId(session.user.id),
        actorName: session.user.name,
        metadata: {
          nodeId: linkedNodeId,
          relationType,
          edgeId,
        },
      });
    }

    // 5. Log Document Knowledge Event
    await DocumentKnowledgeEvent.create({
      hiveId: new mongoose.Types.ObjectId(hiveId),
      documentId: documentDoc._id,
      eventType: "DocumentCreated",
      actorId: new mongoose.Types.ObjectId(session.user.id),
      actorName: session.user.name,
      metadata: {
        nodeId: canvasNodeId,
        type,
      },
    });

    // Invalidate Redis traversal cache
    await invalidateGraphCache(hiveId);

    // Index newly created document and canvas node representation
    await indexDocument(documentDoc._id);
    await indexNode(canvasNodeDoc._id);

    return NextResponse.json({ data: documentDoc, error: null }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/hives/[hiveId]/documents]", err);
    return NextResponse.json({ error: "Internal server error", message: err.message }, { status: 500 });
  }
}
