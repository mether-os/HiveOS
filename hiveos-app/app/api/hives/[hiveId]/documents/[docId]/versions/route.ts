import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Hive from "@/server/models/Hive";
import Document from "@/server/models/Document";
import DocumentVersion from "@/server/models/DocumentVersion";
import DocumentKnowledgeEvent from "@/server/models/DocumentKnowledgeEvent";
import { invalidateGraphCache } from "@/server/utils/graphEngine";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{ hiveId: string; docId: string }>;
}

// GET: List all historical versions for a document
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

    // Verify ownership
    const hive = await Hive.findOne({
      _id: new mongoose.Types.ObjectId(hiveId),
      ownerId: new mongoose.Types.ObjectId(session.user.id),
    });

    if (!hive) {
      return NextResponse.json({ error: "Hive not found or unauthorized", data: null }, { status: 404 });
    }

    const versions = await DocumentVersion.find({
      documentId: new mongoose.Types.ObjectId(docId),
    })
      .sort({ version: -1 })
      .exec();

    return NextResponse.json({ data: versions, error: null }, { status: 200 });
  } catch (err: any) {
    console.error("[GET /api/hives/[hiveId]/documents/[docId]/versions]", err);
    return NextResponse.json({ error: "Internal server error", message: err.message }, { status: 500 });
  }
}

// POST: Restore a previous version
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { hiveId, docId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized", data: null }, { status: 401 });
    }

    const body = await request.json();
    const { versionNumber } = body;

    if (versionNumber === undefined || typeof versionNumber !== "number") {
      return NextResponse.json({ error: "Valid versionNumber is required" }, { status: 400 });
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

    const doc = await Document.findOne({
      _id: new mongoose.Types.ObjectId(docId),
      hiveId: new mongoose.Types.ObjectId(hiveId),
    }).exec();

    if (!doc) {
      return NextResponse.json({ error: "Document not found", data: null }, { status: 404 });
    }

    // Find the requested snapshot version
    const targetVersion = await DocumentVersion.findOne({
      documentId: doc._id,
      version: versionNumber,
    }).exec();

    if (!targetVersion) {
      return NextResponse.json({ error: "Requested version not found" }, { status: 404 });
    }

    // Capture previous document state before rollback
    const lastLoggedVersion = await DocumentVersion.findOne({
      documentId: doc._id,
    })
      .sort({ version: -1 })
      .exec();

    const nextVersionNumber = lastLoggedVersion ? lastLoggedVersion.version + 1 : 1;

    // Save current state as a version snapshot before rolling back
    await DocumentVersion.create({
      documentId: doc._id,
      version: nextVersionNumber,
      title: doc.title,
      content: doc.content,
      authorId: new mongoose.Types.ObjectId(session.user.id),
      authorName: session.user.name,
      changelog: `Backup before restoring version ${versionNumber}`,
      timestamp: new Date(),
    });

    // Roll back the document content and title
    doc.title = targetVersion.title;
    doc.content = targetVersion.content;
    doc.updatedBy = new mongoose.Types.ObjectId(session.user.id);
    await doc.save();

    // Log another version snapshot to log the restored state cleanly
    await DocumentVersion.create({
      documentId: doc._id,
      version: nextVersionNumber + 1,
      title: doc.title,
      content: doc.content,
      authorId: new mongoose.Types.ObjectId(session.user.id),
      authorName: session.user.name,
      changelog: `Restored Version ${versionNumber}`,
      timestamp: new Date(),
    });

    // Log Ingestion Event
    await DocumentKnowledgeEvent.create({
      hiveId: new mongoose.Types.ObjectId(hiveId),
      documentId: doc._id,
      eventType: "DocumentRestored",
      actorId: new mongoose.Types.ObjectId(session.user.id),
      actorName: session.user.name,
      metadata: {
        restoredVersion: versionNumber,
        newVersion: nextVersionNumber + 1,
      },
    });

    // Invalidate graph traversal caches
    await invalidateGraphCache(hiveId);

    return NextResponse.json({ data: doc, error: null }, { status: 200 });
  } catch (err: any) {
    console.error("[POST /api/hives/[hiveId]/documents/[docId]/versions]", err);
    return NextResponse.json({ error: "Internal server error", message: err.message }, { status: 500 });
  }
}
