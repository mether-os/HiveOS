import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import AgentAction from "@/server/models/AgentAction";
import mongoose from "mongoose";
import { wrapApiRoute } from "@/lib/apiWrapper";

export const GET = wrapApiRoute(async (request, { params }, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;

  if (!hiveId) {
    return NextResponse.json({ error: "Missing hiveId" }, { status: 400 });
  }

  reqLogger.info(`Listing agent actions for hive: ${hiveId}`);
  const actions = await AgentAction.find({
    hiveId: new mongoose.Types.ObjectId(hiveId),
  })
    .sort({ createdAt: -1 })
    .lean()
    .exec();

  return NextResponse.json({ data: actions });
});

export const POST = wrapApiRoute(async (request, { params }, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;
  const body = await request.json();
  const { recommendationId, actionType, params: actionParams, riskLevel, requestedBy } = body;

  if (!hiveId || !actionType || !actionParams || !requestedBy) {
    return NextResponse.json(
      { error: "Missing actionType, params, or requestedBy" },
      { status: 400 }
    );
  }

  reqLogger.info(`Submitting agent action proposal for hive: ${hiveId}, actionType: ${actionType}`);

  const action = await AgentAction.create({
    hiveId: new mongoose.Types.ObjectId(hiveId),
    recommendationId: recommendationId ? new mongoose.Types.ObjectId(recommendationId) : undefined,
    actionType,
    params: actionParams,
    riskLevel: riskLevel || "medium",
    status: "pending_approval",
    requestedBy,
    auditLogs: [`Action proposal submitted by ${requestedBy} at ${new Date().toISOString()}`],
  });

  return NextResponse.json({ success: true, data: action });
});

export const PATCH = wrapApiRoute(async (request, { params }, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;
  const body = await request.json();
  const { actionId, status, userId, notes } = body;

  if (!hiveId || !actionId || !status || !userId) {
    return NextResponse.json(
      { error: "Missing actionId, status, or userId" },
      { status: 400 }
    );
  }

  if (!["approved", "rejected", "executed", "failed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
  }

  reqLogger.info(`Updating agent action ${actionId} status to: ${status} by user: ${userId}`);

  const now = new Date();
  const auditMsg = `Action status updated to ${status} by user ${userId} at ${now.toISOString()}.${
    notes ? ` Notes: ${notes}` : ""
  }`;

  const updatedAction = await AgentAction.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(actionId),
      hiveId: new mongoose.Types.ObjectId(hiveId),
    },
    {
      $set: {
        status,
        approvedBy: status === "approved" || status === "rejected" ? new mongoose.Types.ObjectId(userId) : undefined,
        approvedAt: status === "approved" || status === "rejected" ? now : undefined,
        executedAt: status === "executed" ? now : undefined,
      },
      $push: {
        auditLogs: auditMsg,
      },
    },
    { new: true }
  ).exec();

  if (!updatedAction) {
    return NextResponse.json({ error: "Agent action not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: updatedAction });
});
