import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import AgentInstance from "@/server/models/AgentInstance";
import Hive from "@/server/models/Hive";
import mongoose from "mongoose";
import { wrapApiRoute } from "@/lib/apiWrapper";
import { seedAgentsForHive, AGENT_DEFINITIONS } from "@/server/utils/agentRegistry";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

type RouteContext = { params: Promise<{ hiveId: string }> };

/**
 * GET /api/hives/[hiveId]/intelligence/agents
 * Lists all agent definitions merged with their database instances for a hive.
 */
export const GET = wrapApiRoute(async (request: NextRequest, { params }: RouteContext, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;

  if (!hiveId || !mongoose.Types.ObjectId.isValid(hiveId)) {
    return NextResponse.json({ error: "Invalid or missing hiveId" }, { status: 400 });
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership
  const hive = await Hive.findOne({
    _id: new mongoose.Types.ObjectId(hiveId),
    ownerId: new mongoose.Types.ObjectId(session.user.id),
  });

  if (!hive) {
    return NextResponse.json({ error: "Hive not found or unauthorized" }, { status: 404 });
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
