import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { wrapApiRoute } from "@/lib/apiWrapper";
import { HiveMindChatService } from "@/server/services/hivemind-chat/hivemindChat";
import ChatMetric from "@/server/models/ChatMetric";
import mongoose from "mongoose";

type RouteContext = { params: Promise<{ hiveId: string }> };

function classifyQuestion(query: string): string {
  const lower = query.toLowerCase();
  if (lower.includes("risk") || lower.includes("spof") || lower.includes("security") || lower.includes("vulnerability") || lower.includes("threat")) {
    return "risk";
  }
  if (lower.includes("cycle") || lower.includes("dependency") || lower.includes("bottleneck") || lower.includes("architecture") || lower.includes("topology")) {
    return "architecture";
  }
  if (lower.includes("document") || lower.includes("prd") || lower.includes("spec") || lower.includes("feature") || lower.includes("strategist")) {
    return "product";
  }
  return "general";
}

/**
 * POST /api/hives/[hiveId]/intelligence/chat
 * Submits conversational message history to the query perspective and returns structured intelligence response.
 */
export const POST = wrapApiRoute(async (request: NextRequest, { params }: RouteContext, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;

  if (!hiveId) {
    return NextResponse.json({ error: "Missing hiveId" }, { status: 400 });
  }

  const body = await request.json();
  const { messages, mode = "analyst" } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Messages array is required." }, { status: 400 });
  }

  const lastMessage = messages[messages.length - 1]?.content || "";
  const category = classifyQuestion(lastMessage);

  try {
    const chatResult = await HiveMindChatService.query({
      hiveId,
      messages,
      mode
    });

    const { response, latencyMs, validationSuccess } = chatResult;

    // Calculate citation count
    const citedSourcesCount =
      (response.citations.nodes?.length || 0) +
      (response.citations.documents?.length || 0) +
      (response.citations.workflows?.length || 0);

    // Capture telemetry metrics in DB
    const metric = await ChatMetric.create({
      hiveId: new mongoose.Types.ObjectId(hiveId),
      query: lastMessage,
      answer: response.answer,
      mode,
      questionCategory: category,
      citedSourcesCount,
      suggestionsCount: response.suggestedActions?.length || 0,
      acceptedSuggestionsCount: 0,
      latencyMs,
      validationSuccess,
      timestamp: new Date()
    });

    return NextResponse.json({
      metricId: metric._id.toString(),
      response
    }, { status: 200 });

  } catch (err: any) {
    reqLogger.error(`[Chat Route Error] Failed compiling chat completions:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
