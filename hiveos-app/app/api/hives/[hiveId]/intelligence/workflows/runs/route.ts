import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Workflow from "@/server/models/Workflow";
import WorkflowRun from "@/server/models/WorkflowRun";
import mongoose from "mongoose";
import { wrapApiRoute } from "@/lib/apiWrapper";
import { triggerWorkflowEvent, enforceHumanActor } from "@/server/utils/workflowEngine";

type RouteContext = { params: Promise<{ hiveId: string }> };

/**
 * GET /api/hives/[hiveId]/intelligence/workflows/runs
 * Lists runs and computes execution metrics.
 */
export const GET = wrapApiRoute(async (request: NextRequest, { params }: RouteContext, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;

  if (!hiveId) {
    return NextResponse.json({ error: "Missing hiveId" }, { status: 400 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const getMetrics = url.searchParams.get("metrics") === "true";

  const filter: Record<string, any> = {
    hiveId: new mongoose.Types.ObjectId(hiveId)
  };

  if (status) {
    filter.status = status;
  }

  const runs = await WorkflowRun.find(filter).sort({ createdAt: -1 }).exec();

  if (getMetrics) {
    const allRuns = await WorkflowRun.find({
      hiveId: new mongoose.Types.ObjectId(hiveId)
    }).populate("workflowId").lean().exec();

    const finishedRuns = allRuns.filter(r => r.status === "completed" || r.status === "failed");
    const totalFinished = finishedRuns.length;
    const completedCount = finishedRuns.filter(r => r.status === "completed").length;
    const failedCount = finishedRuns.filter(r => r.status === "failed").length;

    const completionRate = totalFinished > 0 ? Math.round((completedCount / totalFinished) * 100) : 0;
    const failureRate = totalFinished > 0 ? Math.round((failedCount / totalFinished) * 100) : 0;

    const totalDuration = finishedRuns.reduce((acc, r) => acc + (r.executionDurationMs || 0), 0);
    const averageDurationMs = totalFinished > 0 ? Math.round(totalDuration / totalFinished) : 0;

    const successByTriggerType: Record<string, { success: number; failed: number }> = {
      manual: { success: 0, failed: 0 },
      mission_completion: { success: 0, failed: 0 },
      risk_resolved: { success: 0, failed: 0 },
      recommendation_accepted: { success: 0, failed: 0 },
      health_score_threshold: { success: 0, failed: 0 },
      schedule: { success: 0, failed: 0 }
    };

    for (const run of finishedRuns) {
      // Find trigger type from associated workflow or default to manual
      const workflow = run.workflowId as any;
      const tType = workflow?.trigger?.type || "manual";
      
      if (!successByTriggerType[tType]) {
        successByTriggerType[tType] = { success: 0, failed: 0 };
      }

      if (run.status === "completed") {
        successByTriggerType[tType]!.success++;
      } else {
        successByTriggerType[tType]!.failed++;
      }
    }

    return NextResponse.json({
      runs,
      metrics: {
        totalFinished,
        completedCount,
        failedCount,
        workflowCompletionRate: completionRate,
        workflowFailureRate: failureRate,
        averageDurationMs,
        successByTriggerType
      }
    });
  }

  return NextResponse.json({ runs });
});

/**
 * POST /api/hives/[hiveId]/intelligence/workflows/runs
 * Manually starts/triggers a workflow.
 */
export const POST = wrapApiRoute(async (request: NextRequest, { params }: RouteContext, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;

  if (!hiveId) {
    return NextResponse.json({ error: "Missing hiveId" }, { status: 400 });
  }

  const body = await request.json();
  const { workflowId, actorId, actorName, context = {} } = body;

  if (!workflowId || !actorId || !actorName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Block AI agents from manual triggering
  try {
    enforceHumanActor(actorId);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }

  const workflow = await Workflow.findById(workflowId).exec();
  if (!workflow) {
    return NextResponse.json({ error: "Workflow definition not found" }, { status: 404 });
  }

  // Generate proposed run manually
  const mergedContext = {
    ...context,
    userId: actorId,
    userName: actorName
  };

  const runs = await triggerWorkflowEvent(hiveId, "manual", {
    ...mergedContext,
    parentWorkflowId: context.parentWorkflowId,
    parentRunId: context.parentRunId
  });

  // Since it's a manual trigger, we return the specific run matching this workflow
  const matchingRun = runs.find(r => r.workflowId.toString() === workflowId.toString());

  return NextResponse.json({ run: matchingRun || runs[0] });
});
