import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { wrapApiRoute } from "@/lib/apiWrapper";
import ChatMetric from "@/server/models/ChatMetric";

type RouteContext = { params: Promise<{ hiveId: string }> };

/**
 * POST /api/hives/[hiveId]/intelligence/chat/suggestions/accept
 * Increments the accepted suggestions counter for a specific chat interaction metric
 */
export const POST = wrapApiRoute(async (request: NextRequest, { params }: RouteContext, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;

  if (!hiveId) {
    return NextResponse.json({ error: "Missing hiveId" }, { status: 400 });
  }

  const body = await request.json();
  const { metricId } = body;

  if (!metricId) {
    return NextResponse.json({ error: "metricId is required." }, { status: 400 });
  }

  try {
    const metricDoc = await ChatMetric.findById(metricId).exec();
    if (!metricDoc) {
      return NextResponse.json({ error: "Metric record not found." }, { status: 404 });
    }

    // Safeguard: increment acceptedSuggestionsCount up to suggestionsCount
    if (metricDoc.acceptedSuggestionsCount < metricDoc.suggestionsCount) {
      metricDoc.acceptedSuggestionsCount += 1;
      await metricDoc.save();
    }

    return NextResponse.json({ success: true, acceptedSuggestionsCount: metricDoc.acceptedSuggestionsCount });
  } catch (err: any) {
    reqLogger.error(`[Suggestions Accept Error] Failed to accept suggestion:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
