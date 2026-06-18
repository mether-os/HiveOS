import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { wrapApiRoute } from "@/lib/apiWrapper";
import { runAgentAnalysis } from "@/server/utils/agentRegistry";

type RouteContext = { params: Promise<{ hiveId: string; agentId: string }> };

/**
 * POST /api/hives/[hiveId]/intelligence/agents/[agentId]/propose
 * Instructs the agent to analyze context and generate a workflow run proposal.
 */
export const POST = wrapApiRoute(async (request: NextRequest, { params }: RouteContext, reqLogger) => {
  await connectDB();
  const { hiveId, agentId } = await params;

  if (!hiveId || !agentId) {
    return NextResponse.json({ error: "Missing hiveId or agentId" }, { status: 400 });
  }

  try {
    const proposal = await runAgentAnalysis(hiveId, agentId);
    return NextResponse.json({ proposal }, { status: 201 });
  } catch (err: any) {
    reqLogger.error(`[Agent Propose Error] Agent ${agentId} analysis run failed:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
