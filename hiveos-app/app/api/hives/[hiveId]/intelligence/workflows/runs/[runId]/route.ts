import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import WorkflowRun from "@/server/models/WorkflowRun";
import mongoose from "mongoose";
import { wrapApiRoute } from "@/lib/apiWrapper";
import {
  approveWorkflowProposal,
  executeWorkflowRun,
  pauseWorkflow,
  resumeWorkflow,
  submitStepApproval,
  enforceHumanActor
} from "@/server/utils/workflowEngine";

type RouteContext = { params: Promise<{ hiveId: string; runId: string }> };

/**
 * PATCH /api/hives/[hiveId]/intelligence/workflows/runs/[runId]
 * Performs workflow operations: approve, reject, pause, resume, activate, approve_step.
 */
export const PATCH = wrapApiRoute(async (request: NextRequest, { params }: RouteContext, reqLogger) => {
  await connectDB();
  const { hiveId, runId } = await params;

  if (!hiveId || !runId) {
    return NextResponse.json({ error: "Missing hiveId or runId" }, { status: 400 });
  }

  const body = await request.json();
  const { action, actorId, actorName, stepNumber } = body;

  if (!action || !actorId || !actorName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Enforce human constraint on approvals, activations, and controls
  try {
    enforceHumanActor(actorId);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const run = await WorkflowRun.findOne({
    _id: new mongoose.Types.ObjectId(runId),
    hiveId: new mongoose.Types.ObjectId(hiveId)
  }).exec();

  if (!run) {
    return NextResponse.json({ error: "Workflow run not found" }, { status: 404 });
  }

  try {
    let updatedRun;
    switch (action) {
      case "approve":
        updatedRun = await approveWorkflowProposal(runId, actorId, actorName);
        break;

      case "reject":
        run.status = "failed";
        run.logs.push({
          timestamp: new Date(),
          message: `Workflow proposal rejected by ${actorName}.`,
          severity: "warn"
        });
        await run.save();
        updatedRun = run;
        break;

      case "activate":
      case "resume":
        updatedRun = await executeWorkflowRun(runId, actorId, actorName);
        break;

      case "pause":
        updatedRun = await pauseWorkflow(runId, actorId, actorName);
        break;

      case "approve_step":
        if (stepNumber === undefined) {
          return NextResponse.json({ error: "Missing stepNumber parameter" }, { status: 400 });
        }
        updatedRun = await submitStepApproval(runId, stepNumber, actorId, actorName);
        break;

      default:
        return NextResponse.json({ error: `Unsupported workflow run action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ run: updatedRun });
  } catch (err: any) {
    reqLogger.error(`[WorkflowRun Action Error] Action ${action} failed for run ${runId}:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
});
