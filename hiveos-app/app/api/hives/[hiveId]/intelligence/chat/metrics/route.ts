import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { wrapApiRoute } from "@/lib/apiWrapper";
import ChatMetric from "@/server/models/ChatMetric";
import mongoose from "mongoose";

type RouteContext = { params: Promise<{ hiveId: string }> };

/**
 * GET /api/hives/[hiveId]/intelligence/chat/metrics
 * Computes telemetry aggregations for the Conversational Chat Center
 */
export const GET = wrapApiRoute(async (request: NextRequest, { params }: RouteContext, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;

  if (!hiveId) {
    return NextResponse.json({ error: "Missing hiveId" }, { status: 400 });
  }

  const hiveObjectId = new mongoose.Types.ObjectId(hiveId);

  // Fetch all metrics documents for this Hive
  const metrics = await ChatMetric.find({ hiveId: hiveObjectId }).lean().exec();

  const questionsAsked = metrics.length;
  let suggestionsGenerated = 0;
  let acceptedSuggestions = 0;
  let totalLatency = 0;
  let validationSuccesses = 0;

  // Question Category breakdown
  const categoryCounts: Record<string, number> = {
    general: 0,
    architecture: 0,
    product: 0,
    risk: 0
  };

  metrics.forEach((m) => {
    suggestionsGenerated += m.suggestionsCount || 0;
    acceptedSuggestions += m.acceptedSuggestionsCount || 0;
    totalLatency += m.latencyMs || 0;
    if (m.validationSuccess) validationSuccesses++;
    
    const cat = m.questionCategory || "general";
    categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
  });

  const suggestionAcceptanceRate = suggestionsGenerated > 0 
    ? Math.round((acceptedSuggestions / suggestionsGenerated) * 1000) / 10 
    : 0.0;

  const averageLatencyMs = questionsAsked > 0 
    ? Math.round(totalLatency / questionsAsked) 
    : 0;

  const validationSuccessRate = questionsAsked > 0 
    ? Math.round((validationSuccesses / questionsAsked) * 1000) / 10 
    : 100.0;

  return NextResponse.json({
    questionsAsked,
    suggestionsGenerated,
    suggestionAcceptanceRate,
    averageLatencyMs,
    validationSuccessRate,
    categoryCounts
  });
});
