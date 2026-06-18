import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { wrapApiRoute } from "@/lib/apiWrapper";
import { executeActionPlan } from "@/server/utils/executionEngine";

type RouteContext = { params: Promise<{ hiveId: string; planId: string }> };

/**
 * POST /api/hives/[hiveId]/intelligence/action-plans/[planId]/execute
 * Executes an approved action plan using the Controlled Execution Engine.
 *
 * Request Body:
 *   actorId       — string (User ID triggering execution)
 *   actorName     — string (User display name)
 *   stepOverrides — Record<number, any> (optional overrides for specific step parameters)
 *   maxRiskLevel  — "low" | "medium" | "high" | "critical" (optional max risk guard configuration)
 */
export const POST = wrapApiRoute(
  async (request: NextRequest, { params }: RouteContext, reqLogger) => {
    await connectDB();
    const { hiveId, planId } = await params;

    if (!hiveId || !planId) {
      return NextResponse.json({ error: "Missing hiveId or planId" }, { status: 400 });
    }

    interface ExecuteBody {
      actorId?: string;
      actorName?: string;
      stepOverrides?: Record<number, any>;
      maxRiskLevel?: "low" | "medium" | "high" | "critical";
    }

    let body: ExecuteBody = {};
    try {
      body = (await request.json()) as ExecuteBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { actorId, actorName, stepOverrides, maxRiskLevel } = body;

    if (!actorId || !actorName) {
      return NextResponse.json(
        { error: "actorId and actorName are required to log execution audits." },
        { status: 400 }
      );
    }

    reqLogger.info(
      `[API Execution] Triggering execution of plan ${planId} in hive ${hiveId} by ${actorName}`
    );

    const result = await executeActionPlan(
      hiveId,
      planId,
      actorId,
      actorName,
      stepOverrides || {},
      { maxRiskLevel }
    );

    if (!result.success) {
      reqLogger.warn(
        `[API Execution] Execution failed for plan ${planId}: ${result.message}`
      );
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          data: result.plan,
        },
        { status: 422 } // Unprocessable Entity
      );
    }

    reqLogger.info(`[API Execution] Plan ${planId} successfully executed.`);

    return NextResponse.json({
      success: true,
      message: "Action plan successfully executed.",
      data: result.plan,
    });
  }
);
