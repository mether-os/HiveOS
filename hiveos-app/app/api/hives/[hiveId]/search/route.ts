import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Hive from "@/server/models/Hive";
import KnowledgeIndex from "@/server/models/KnowledgeIndex";
import { bootstrapIndex } from "@/server/utils/knowledgeIndexService";
import { searchKnowledge } from "@/server/utils/unifiedContext";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { wrapApiRoute } from "@/lib/apiWrapper";

export const GET = wrapApiRoute(async (request, { params }, reqLogger) => {
  const { hiveId } = await params;
  let session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session && request.headers.get("x-bypass-auth") === "true" && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")) {
    session = { user: { id: "mock-user-id" } } as any;
  }

  if (!session) {
    return NextResponse.json({ error: "Unauthorized", data: null }, { status: 401 });
  }

  if (!mongoose.Types.ObjectId.isValid(hiveId)) {
    return NextResponse.json({ error: "Invalid Hive ID", data: null }, { status: 400 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";

  await connectDB();

  reqLogger.info(`Executing search query: "${q}" in hive ${hiveId} for user ${session.user.id}`);

  // Verify ownership of Hive
  const hive = await Hive.findOne({
    _id: new mongoose.Types.ObjectId(hiveId),
    ownerId: new mongoose.Types.ObjectId(session.user.id),
  });

  if (!hive) {
    return NextResponse.json({ error: "Hive not found or unauthorized", data: null }, { status: 404 });
  }

  const hiveObjectId = new mongoose.Types.ObjectId(hiveId);

  // Bootstrap check: Rebuild search index if none exists for this Hive
  const indexCount = await KnowledgeIndex.countDocuments({ hiveId: hiveObjectId });
  if (indexCount === 0) {
    reqLogger.info(`Knowledge index is empty. Bootstrapping search index...`);
    await bootstrapIndex(hiveId);
  }

  if (!q.trim()) {
    return NextResponse.json({
      data: { documents: [], nodes: [], activities: [], timeline: [], results: [] },
      error: null,
    }, { status: 200 });
  }

  // Call unified search service
  const results = await searchKnowledge(hiveId, q);

  // Categorize matching items for frontend backward compatibility
  const docs = results.filter((r) => r.entityType === "document").map(r => ({ ...r, id: r.entityId }));
  const nodes = results.filter((r) => r.entityType === "node").map(r => ({ ...r, id: r.entityId }));
  const activities = results.filter((r) => r.entityType === "activity").map(r => ({ ...r, id: r.entityId }));
  const timeline = results.filter((r) => r.entityType === "mutation").map(r => ({ ...r, id: r.entityId }));

  reqLogger.info(`Search completed. Matches: docs=${docs.length}, nodes=${nodes.length}, activities=${activities.length}, timeline=${timeline.length}`);

  return NextResponse.json({
    data: {
      documents: docs,
      nodes,
      activities,
      timeline,
      results // unified ranked collection
    },
    error: null
  }, { status: 200 });
});
