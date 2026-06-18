import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import AgentActionPlan from "@/server/models/AgentActionPlan";
import mongoose from "mongoose";
import { wrapApiRoute } from "@/lib/apiWrapper";
import {
  generateActionPlans,
  expireStalePlans,
} from "@/server/utils/agentActionEngine";

type RouteContext = { params: Promise<{ hiveId: string }> };

/**
 * GET /api/hives/[hiveId]/intelligence/action-plans
 * Lists all action plans with optional status filter and sort.
 *
 * Query params:
 *   status   — filter: proposed | approved | rejected | expired (default: all)
 *   sort     — sort: confidence | risk | quality | date (default: date)
 *   order    — asc | desc (default: desc)
 *   limit    — max results (default: 50)
 */
export const GET = wrapApiRoute(async (request: NextRequest, { params }: RouteContext, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;

  if (!hiveId) {
    return NextResponse.json({ error: "Missing hiveId" }, { status: 400 });
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const sort = url.searchParams.get("sort") || "date";
  const order = url.searchParams.get("order") === "asc" ? 1 : -1;
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50", 10));
  const getMetrics = url.searchParams.get("metrics") === "true";

  // First expire any stale plans
  const expiredCount = await expireStalePlans(hiveId);
  if (expiredCount > 0) {
    reqLogger.info(`[ActionPlans] Expired ${expiredCount} stale plans for hive: ${hiveId}`);
  }

  if (getMetrics) {
    const executedPlans = await AgentActionPlan.find({
      hiveId: new mongoose.Types.ObjectId(hiveId),
      status: { $in: ["executed", "failed"] },
    }).lean().exec();

    const totalExecuted = executedPlans.length;
    const successCount = executedPlans.filter((p) => p.executionResult === "success").length;
    const failedCount = executedPlans.filter((p) => p.executionResult === "failed").length;
    const partialCount = executedPlans.filter((p) => p.executionResult === "partial").length;

    const successRate = totalExecuted > 0 ? Math.round((successCount / totalExecuted) * 100) : 0;
    const failureRate = totalExecuted > 0 ? Math.round((failedCount / totalExecuted) * 100) : 0;
    const partialRate = totalExecuted > 0 ? Math.round((partialCount / totalExecuted) * 100) : 0;

    const totalLatency = executedPlans.reduce((acc, p) => acc + (p.executionLatencyMs || 0), 0);
    const averageExecutionLatencyMs = totalExecuted > 0 ? Math.round(totalLatency / totalExecuted) : 0;

    const successByActionType: Record<string, { success: number; failed: number }> = {};

    for (const plan of executedPlans) {
      const failedSteps = new Set(
        (plan.executionDetails?.entitiesFailed || []).map((f: any) => f.stepNumber)
      );

      for (const step of plan.steps) {
        if (!successByActionType[step.actionType]) {
          successByActionType[step.actionType] = { success: 0, failed: 0 };
        }

        if (plan.executionResult === "success") {
          successByActionType[step.actionType]!.success++;
        } else if (plan.executionResult === "failed") {
          successByActionType[step.actionType]!.failed++;
        } else if (plan.executionResult === "partial") {
          if (failedSteps.has(step.stepNumber)) {
            successByActionType[step.actionType]!.failed++;
          } else {
            successByActionType[step.actionType]!.success++;
          }
        }
      }
    }

    return NextResponse.json({
      metrics: {
        totalExecuted,
        successCount,
        failedCount,
        partialCount,
        executionSuccessRate: successRate,
        executionFailureRate: failureRate,
        executionPartialRate: partialRate,
        averageExecutionLatencyMs,
        successByActionType,
      },
    });
  }


  const filter: Record<string, unknown> = {
    hiveId: new mongoose.Types.ObjectId(hiveId),
  };
  if (statusFilter && ["proposed", "approved", "rejected", "expired"].includes(statusFilter)) {
    (filter as Record<string, unknown>).status = statusFilter;
  }

  const sortMap: Record<string, Record<string, number>> = {
    confidence: { confidence: order, createdAt: -1 },
    risk: { riskScore: order === 1 ? -1 : 1, createdAt: -1 }, // Higher risk first by default
    quality: { actionQualityScore: order, createdAt: -1 },
    date: { createdAt: order },
  };

  const sortOptions = sortMap[sort] || sortMap.date!;

  reqLogger.info(`[ActionPlans] Listing plans for hive: ${hiveId}, status: ${statusFilter || "all"}, sort: ${sort}`);

  const plans = await AgentActionPlan.find(filter)
    .sort(sortOptions as Record<string, 1 | -1>)
    .limit(limit)
    .lean()
    .exec();

  const counts = await AgentActionPlan.aggregate([
    { $match: { hiveId: new mongoose.Types.ObjectId(hiveId) } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const statusCounts: Record<string, number> = {
    proposed: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
  };
  counts.forEach((c: { _id: string; count: number }) => {
    if (c._id in statusCounts) {
      statusCounts[c._id] = c.count;
    }
  });

  return NextResponse.json({
    data: plans,
    meta: {
      total: plans.length,
      statusCounts,
      expiredThisRun: expiredCount,
    },
  });
});

/**
 * POST /api/hives/[hiveId]/intelligence/action-plans
 * Triggers generation of new action plans from current diagnostics.
 *
 * Body (optional):
 *   confidenceThreshold  — number 0–1 (default: 0.6)
 *   maxPlansPerRun       — number (default: 20)
 *   expiryHours          — number (default: 72)
 */
export const POST = wrapApiRoute(async (request: NextRequest, { params }: RouteContext, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;

  if (!hiveId) {
    return NextResponse.json({ error: "Missing hiveId" }, { status: 400 });
  }

  interface ActionPlansBody {
    confidenceThreshold?: number;
    maxPlansPerRun?: number;
    expiryHours?: number;
  }
  let body: ActionPlansBody = {};
  try {
    body = (await request.json()) as ActionPlansBody;
  } catch {
    // Body is optional — defaults apply
  }

  const { confidenceThreshold, maxPlansPerRun, expiryHours } = body;

  reqLogger.info(`[ActionPlans] Generating action plans for hive: ${hiveId}`);

  const result = await generateActionPlans(hiveId, {
    confidenceThreshold: typeof confidenceThreshold === "number" ? confidenceThreshold : 0.6,
    maxPlansPerRun: typeof maxPlansPerRun === "number" ? maxPlansPerRun : 20,
    expiryHours: typeof expiryHours === "number" ? expiryHours : 72,
  });

  reqLogger.info(
    `[ActionPlans] Generated ${result.generated} plans, skipped ${result.skipped} for hive: ${hiveId}`
  );

  return NextResponse.json({
    success: true,
    data: {
      generated: result.generated,
      skipped: result.skipped,
      plans: result.plans,
    },
  });
});
