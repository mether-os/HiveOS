import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import AgentInstance from "@/server/models/AgentInstance";
import mongoose from "mongoose";
import { wrapApiRoute } from "@/lib/apiWrapper";
import { seedAgentsForHive, AGENT_DEFINITIONS } from "@/server/utils/agentRegistry";

type RouteContext = { params: Promise<{ hiveId: string }> };

/**
 * GET /api/hives/[hiveId]/intelligence/agents
 * Lists all agent definitions merged with their database instances for a hive.
 */
export const GET = wrapApiRoute(async (request: NextRequest, { params }: RouteContext, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;

  if (!hiveId) {
    return NextResponse.json({ error: "Missing hiveId" }, { status: 400 });
  }

  // Ensure agent instances are seeded for this hive
  await seedAgentsForHive(hiveId);

  const instances = await AgentInstance.find({
    hiveId: new mongoose.Types.ObjectId(hiveId)
  }).lean().exec();

  // Merge definition metadata with instance configurations
  const mergedAgents = AGENT_DEFINITIONS.map(def => {
    const inst = instances.find(i => i.agentId === def.id);
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      capabilities: def.capabilities,
      minimumRiskLevel: def.minimumRiskLevel,
      status: inst?.status ?? "active",
      riskLevel: inst?.riskLevel ?? def.minimumRiskLevel,
      metrics: inst?.metrics ?? {
        proposalsGenerated: 0,
        proposalsApproved: 0,
        proposalsRejected: 0,
        workflowSuccessCount: 0,
        workflowFailureCount: 0,
        totalConfidence: 0,
        proposalEffectivenessScore: 0
      },
      overrides: inst?.overrides ?? {}
    };
  });

  return NextResponse.json({ agents: mergedAgents });
});
