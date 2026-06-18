import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import AgentInstance from "@/server/models/AgentInstance";
import mongoose from "mongoose";
import { wrapApiRoute } from "@/lib/apiWrapper";
import { AGENT_DEFINITIONS, isRiskLevelBelow, seedAgentsForHive } from "@/server/utils/agentRegistry";
import { enforceHumanActor } from "@/server/utils/workflowEngine";

type RouteContext = { params: Promise<{ hiveId: string; agentId: string }> };

/**
 * PATCH /api/hives/[hiveId]/intelligence/agents/[agentId]
 * Updates status or riskLevel configuration of an agent instance.
 */
export const PATCH = wrapApiRoute(async (request: NextRequest, { params }: RouteContext, reqLogger) => {
  await connectDB();
  const { hiveId, agentId } = await params;

  if (!hiveId || !agentId) {
    return NextResponse.json({ error: "Missing hiveId or agentId" }, { status: 400 });
  }

  const def = AGENT_DEFINITIONS.find(d => d.id === agentId);
  if (!def) {
    return NextResponse.json({ error: "Agent definition not found" }, { status: 404 });
  }

  const body = await request.json();
  const { status, riskLevel, actorId } = body;

  // Enforce human enforcer
  if (actorId) {
    try {
      enforceHumanActor(actorId);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
  }

  // Validate risk level bounds override
  if (riskLevel) {
    if (isRiskLevelBelow(riskLevel, def.minimumRiskLevel)) {
      return NextResponse.json({
        error: `Cannot lower risk level below the system-defined minimum of: ${def.minimumRiskLevel}`
      }, { status: 400 });
    }
  }

  const hiveObjectId = new mongoose.Types.ObjectId(hiveId);
  let inst = await AgentInstance.findOne({ hiveId: hiveObjectId, agentId }).exec();

  if (!inst) {
    await seedAgentsForHive(hiveId);
    inst = await AgentInstance.findOne({ hiveId: hiveObjectId, agentId }).exec();
  }

  if (!inst) {
    return NextResponse.json({ error: "Agent instance not found" }, { status: 404 });
  }

  if (status !== undefined) {
    inst.status = status;
  }
  if (riskLevel !== undefined) {
    inst.riskLevel = riskLevel;
  }

  await inst.save();

  return NextResponse.json({ agent: inst });
});
