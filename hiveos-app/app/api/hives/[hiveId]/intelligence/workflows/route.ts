import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Workflow from "@/server/models/Workflow";
import mongoose from "mongoose";
import { wrapApiRoute } from "@/lib/apiWrapper";
import { seedTemplatesForHive, enforceHumanActor } from "@/server/utils/workflowEngine";

type RouteContext = { params: Promise<{ hiveId: string }> };

/**
 * GET /api/hives/[hiveId]/intelligence/workflows
 * Lists all workflow definitions and templates for a hive.
 */
export const GET = wrapApiRoute(async (request: NextRequest, { params }: RouteContext, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;

  if (!hiveId) {
    return NextResponse.json({ error: "Missing hiveId" }, { status: 400 });
  }

  // Ensure default templates are seeded
  await seedTemplatesForHive(hiveId);

  const workflows = await Workflow.find({
    hiveId: new mongoose.Types.ObjectId(hiveId)
  }).sort({ createdAt: -1 }).exec();

  return NextResponse.json({ workflows });
});

/**
 * POST /api/hives/[hiveId]/intelligence/workflows
 * Creates a custom workflow definition.
 */
export const POST = wrapApiRoute(async (request: NextRequest, { params }: RouteContext, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;

  if (!hiveId) {
    return NextResponse.json({ error: "Missing hiveId" }, { status: 400 });
  }

  const body = await request.json();
  const { name, description, trigger, steps, actorId } = body;

  if (!name || !description || !trigger || !steps) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Check that the actor is human
  if (actorId) {
    try {
      enforceHumanActor(actorId);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
  }

  const workflow = await Workflow.create({
    hiveId: new mongoose.Types.ObjectId(hiveId),
    name,
    description,
    trigger,
    steps,
    status: "active",
    isTemplate: false,
    createdBy: actorId ? new mongoose.Types.ObjectId(actorId) : undefined
  });

  return NextResponse.json({ workflow }, { status: 201 });
});
