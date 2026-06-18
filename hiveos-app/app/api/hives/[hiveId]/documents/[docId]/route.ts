import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Hive from "@/server/models/Hive";
import Document from "@/server/models/Document";
import DocumentVersion from "@/server/models/DocumentVersion";
import CanvasNode from "@/server/models/CanvasNode";
import CanvasEdge from "@/server/models/CanvasEdge";
import DocumentKnowledgeEvent from "@/server/models/DocumentKnowledgeEvent";
import { invalidateGraphCache } from "@/server/utils/graphEngine";
import { indexDocument, deindexEntity, indexNode } from "@/server/utils/knowledgeIndexService";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{ hiveId: string; docId: string }>;
}

const VERSION_TIME_THRESHOLD = 10 * 60 * 1000; // 10 minutes

// GET: Retrieve a document by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { hiveId, docId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized", data: null }, { status: 401 });
    }

    await connectDB();

    // Verify ownership of the Hive
    const hive = await Hive.findOne({
      _id: new mongoose.Types.ObjectId(hiveId),
      ownerId: new mongoose.Types.ObjectId(session.user.id),
    });

    if (!hive) {
      return NextResponse.json({ error: "Hive not found or unauthorized", data: null }, { status: 404 });
    }

    const doc = await Document.findOne({
      _id: new mongoose.Types.ObjectId(docId),
      hiveId: new mongoose.Types.ObjectId(hiveId),
    }).exec();

    if (!doc) {
      return NextResponse.json({ error: "Document not found", data: null }, { status: 404 });
    }

    return NextResponse.json({ data: doc, error: null }, { status: 200 });
  } catch (err: any) {
    console.error("[GET /api/hives/[hiveId]/documents/[docId]]", err);
    return NextResponse.json({ error: "Internal server error", message: err.message }, { status: 500 });
  }
}

// PATCH/PUT: Update document contents, handle auto-save version thresholds, and update CanvasNode details
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { hiveId, docId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized", data: null }, { status: 401 });
    }

    const body = await request.json();
    const { title, content, status, tags, changelog = "" } = body;

    await connectDB();

    // Verify ownership of Hive
    const hive = await Hive.findOne({
      _id: new mongoose.Types.ObjectId(hiveId),
      ownerId: new mongoose.Types.ObjectId(session.user.id),
    });

    if (!hive) {
      return NextResponse.json({ error: "Hive not found or unauthorized", data: null }, { status: 404 });
    }

    // Fetch previous document state
    const previousDoc = await Document.findOne({
      _id: new mongoose.Types.ObjectId(docId),
      hiveId: new mongoose.Types.ObjectId(hiveId),
    }).exec();

    if (!previousDoc) {
      return NextResponse.json({ error: "Document not found", data: null }, { status: 404 });
    }

    // Determine versioning need
    let versionCreated = false;
    const contentChanged = content !== undefined && content !== previousDoc.content;
    const titleChanged = title !== undefined && title.trim() !== previousDoc.title;

    if (contentChanged || titleChanged) {
      // Find the last version logged
      const lastVersion = await DocumentVersion.findOne({
        documentId: previousDoc._id,
      })
        .sort({ version: -1 })
        .exec();

      let nextVersionNumber = 1;
      let shouldCreateVersion = false;

      if (!lastVersion) {
        shouldCreateVersion = true;
      } else {
        nextVersionNumber = lastVersion.version + 1;
        // Verify time elapsed since the last version exceeds 10 minutes, or if custom changelog was explicitly provided
        const timeElapsed = Date.now() - lastVersion.timestamp.getTime();
        if (timeElapsed > VERSION_TIME_THRESHOLD || changelog) {
          shouldCreateVersion = true;
        }
      }

      if (shouldCreateVersion) {
        // Create snapshot using previous document state before applying new patch
        await DocumentVersion.create({
          documentId: previousDoc._id,
          version: nextVersionNumber,
          title: previousDoc.title,
          content: previousDoc.content,
          authorId: new mongoose.Types.ObjectId(session.user.id),
          authorName: session.user.name,
          changelog: changelog || (nextVersionNumber === 1 ? "Initial Draft" : "Auto-saved snapshot"),
          timestamp: new Date(),
        });
        
        versionCreated = true;

        // Log Version Created Knowledge Event
        await DocumentKnowledgeEvent.create({
          hiveId: new mongoose.Types.ObjectId(hiveId),
          documentId: previousDoc._id,
          eventType: "DocumentVersionCreated",
          actorId: new mongoose.Types.ObjectId(session.user.id),
          actorName: session.user.name,
          metadata: {
            version: nextVersionNumber,
            changelog: changelog || "Auto-saved snapshot",
          },
        });
      }
    }

    // Apply updates to Document record
    const updates: any = {
      updatedBy: new mongoose.Types.ObjectId(session.user.id),
    };
    if (title !== undefined) updates.title = title.trim();
    if (content !== undefined) updates.content = content;
    if (status !== undefined) updates.status = status;
    if (tags !== undefined) updates.tags = tags;

    const updatedDoc = await Document.findByIdAndUpdate(docId, { $set: updates }, { new: true }).exec();

    // Sync matching CanvasNode on title/tags updates
    if (previousDoc.nodeId && (titleChanged || tags !== undefined)) {
      const nodeUpdates: any = {};
      if (titleChanged) nodeUpdates.title = title.trim();
      if (tags !== undefined) nodeUpdates.tags = tags;

      await CanvasNode.updateOne(
        { hiveId: new mongoose.Types.ObjectId(hiveId), id: previousDoc.nodeId },
        { $set: nodeUpdates }
      );
    }

    // Log Document Knowledge Event
    await DocumentKnowledgeEvent.create({
      hiveId: new mongoose.Types.ObjectId(hiveId),
      documentId: previousDoc._id,
      eventType: "DocumentUpdated",
      actorId: new mongoose.Types.ObjectId(session.user.id),
      actorName: session.user.name,
      metadata: {
        versionCreated,
        titleChanged,
        contentChanged,
      },
    });

    // Invalidate Graph Engine traversal caches
    await invalidateGraphCache(hiveId);

    // Update search index
    await indexDocument(docId);
    if (previousDoc.nodeId) {
      await indexNode(previousDoc.nodeId);
    }

    return NextResponse.json({ data: updatedDoc, error: null }, { status: 200 });
  } catch (err: any) {
    console.error("[PATCH /api/hives/[hiveId]/documents/[docId]]", err);
    return NextResponse.json({ error: "Internal server error", message: err.message }, { status: 500 });
  }
}

// DELETE: Deletes document, associated CanvasNode and associated CanvasEdge records
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { hiveId, docId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized", data: null }, { status: 401 });
    }

    await connectDB();

    // Verify ownership of Hive
    const hive = await Hive.findOne({
      _id: new mongoose.Types.ObjectId(hiveId),
      ownerId: new mongoose.Types.ObjectId(session.user.id),
    });

    if (!hive) {
      return NextResponse.json({ error: "Hive not found or unauthorized", data: null }, { status: 404 });
    }

    const doc = await Document.findOne({
      _id: new mongoose.Types.ObjectId(docId),
      hiveId: new mongoose.Types.ObjectId(hiveId),
    }).exec();

    if (!doc) {
      return NextResponse.json({ error: "Document not found", data: null }, { status: 404 });
    }

    // 1. Delete Document record
    await Document.deleteOne({ _id: doc._id });

    // 2. Cascade delete document versions
    await DocumentVersion.deleteMany({ documentId: doc._id });

    // 3. Cascade delete corresponding CanvasNode
    if (doc.nodeId) {
      await CanvasNode.deleteOne({ hiveId: new mongoose.Types.ObjectId(hiveId), id: doc.nodeId });
      
      // Cascade delete edges connected to Document Node
      await CanvasEdge.deleteMany({
        hiveId: new mongoose.Types.ObjectId(hiveId),
        $or: [{ source: doc.nodeId }, { target: doc.nodeId }],
      });
    }

    // Invalidate caches
    await invalidateGraphCache(hiveId);

    // Update search index
    await deindexEntity(docId);
    if (doc.nodeId) {
      await deindexEntity(doc.nodeId);
    }

    return NextResponse.json({ data: { message: "Document deleted successfully" }, error: null }, { status: 200 });
  } catch (err: any) {
    console.error("[DELETE /api/hives/[hiveId]/documents/[docId]]", err);
    return NextResponse.json({ error: "Internal server error", message: err.message }, { status: 500 });
  }
}
