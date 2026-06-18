import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import AgentActionPlan from "@/server/models/AgentActionPlan";
import mongoose from "mongoose";
import { wrapApiRoute } from "@/lib/apiWrapper";
import {
  simulateActionPlan,
  approveActionPlan,
  rejectActionPlan,
} from "@/server/utils/agentActionEngine";

type RouteContext = { params: Promise<{ hiveId: string; planId: string }> };

/**
 * GET /api/hives/[hiveId]/intelligence/action-plans/[planId]
 * Returns a single action plan with its simulation preview.
 */
export const GET = wrapApiRoute(
  async (request: NextRequest, { params }: RouteContext, reqLogger) => {
    await connectDB();
    const { hiveId, planId } = await params;

    if (!hiveId || !planId) {
      return NextResponse.json({ error: "Missing hiveId or planId" }, { status: 400 });
    }

    reqLogger.info(`[ActionPlan Detail] Fetching plan ${planId} for hive: ${hiveId}`);

    const plan = await AgentActionPlan.findOne({
      _id: new mongoose.Types.ObjectId(planId),
      hiveId: new mongoose.Types.ObjectId(hiveId),
    })
      .lean()
      .exec();

    if (!plan) {
      return NextResponse.json({ error: "Action plan not found" }, { status: 404 });
    }

    // Run simulation
    const simulation = await simulateActionPlan(hiveId, planId);

    return NextResponse.json({
      data: plan,
      simulation,
    });
  }
);

/**
 * PATCH /api/hives/[hiveId]/intelligence/action-plans/[planId]
 * Approve or reject an action plan (no execution).
 *
 * Body:
 *   decision  — "approved" | "rejected"
 *   actorId   — string (user ID)
 *   actorName — string (display name)
 *   notes     — string (optional)
 */
export const PATCH = wrapApiRoute(
  async (request: NextRequest, { params }: RouteContext, reqLogger) => {
    await connectDB();
    const { hiveId, planId } = await params;

    if (!hiveId || !planId) {
      return NextResponse.json({ error: "Missing hiveId or planId" }, { status: 400 });
    }

    interface DecisionBody {
      decision?: string;
      actorId?: string;
      actorName?: string;
      notes?: string;
    }
    const body = (await request.json()) as DecisionBody;
    const { decision, actorId, actorName, notes } = body;

    if (!decision || !["approved", "rejected"].includes(decision)) {
      return NextResponse.json(
        { error: "decision must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    if (!actorId || !actorName) {
      return NextResponse.json(
        { error: "Missing actorId or actorName" },
        { status: 400 }
      );
    }

    reqLogger.info(
      `[ActionPlan Decision] Plan ${planId} → ${decision} by ${actorName} (${actorId}) for hive: ${hiveId}`
    );

    let updatedPlan;
    if (decision === "approved") {
      updatedPlan = await approveActionPlan(hiveId, planId, actorId, actorName, notes);
    } else {
      updatedPlan = await rejectActionPlan(hiveId, planId, actorId, actorName, notes);
    }

    if (!updatedPlan) {
      return NextResponse.json(
        { error: "Plan not found or already decided (must be 'proposed')" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updatedPlan });
  }
);
