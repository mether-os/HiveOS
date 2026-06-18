import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { runHiveMindAnalysis, runAnalysisBackground } from "@/server/utils/hiveMindService";
import HiveMindSnapshot from "@/server/models/HiveMindSnapshot";
import { wrapApiRoute } from "@/lib/apiWrapper";
import mongoose from "mongoose";

export const GET = wrapApiRoute(async (request, { params }, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;

  if (!hiveId) {
    return NextResponse.json({ error: "Missing hiveId" }, { status: 400 });
  }

  const url = new URL(request.url);
  const forceSync = url.searchParams.get("forceSync") === "true";

  if (forceSync) {
    // forceSync is strictly disabled in production
    if (process.env.NODE_ENV === "production") {
      reqLogger.warn(`Block forceSync attempt in production for hive: ${hiveId}`);
      return NextResponse.json({ error: "forceSync is disabled in production" }, { status: 400 });
    }
    
    reqLogger.info(`Running synchronous HiveMind analysis for hive: ${hiveId}`);
    const data = await runHiveMindAnalysis(hiveId);
    return NextResponse.json({ data });
  }

  // Retrieve the latest snapshot
  const latestSnapshot = await HiveMindSnapshot.findOne({
    hiveId: new mongoose.Types.ObjectId(hiveId),
  })
    .sort({ timestamp: -1 })
    .exec();

  const STALE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes
  const isStale = !latestSnapshot || (Date.now() - new Date(latestSnapshot.timestamp).getTime() > STALE_THRESHOLD_MS);

  if (isStale) {
    reqLogger.info(`Snapshot is missing or stale. Triggering background analysis for hive: ${hiveId}`);
    // Trigger the background analysis worker (asynchronous, stateless LLM run)
    runAnalysisBackground(hiveId);
  }

  if (latestSnapshot) {
    reqLogger.info(`Returning cached snapshot from ${new Date(latestSnapshot.timestamp).toLocaleTimeString()}`);
    return NextResponse.json({ data: latestSnapshot });
  }

  // If no snapshot exists at all, run a fast rule-based baseline synchronously to bootstrap the UI
  reqLogger.info(`No snapshot found. Bootstrapping with rule-based baseline synchronously for hive: ${hiveId}`);
  const baseline = await runHiveMindAnalysis(hiveId, { skipLLM: true });
  return NextResponse.json({ data: baseline });
});
