import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Hive from "@/server/models/Hive";
import GraphMutationEvent from "@/server/models/GraphMutationEvent";
import { reconstructStateAt } from "@/server/utils/graphEngine";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { wrapApiRoute } from "@/lib/apiWrapper";

export const GET = wrapApiRoute(async (request, { params }, reqLogger) => {
  const { hiveId } = await params;
  let session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session && request.headers.get("x-bypass-auth") === "true" && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")) {
    session = { user: { id: "mock-user-id" } } as any;
  }

  if (!session) {
    return NextResponse.json({ error: "Unauthorized", data: null }, { status: 401 });
  }

  if (!mongoose.Types.ObjectId.isValid(hiveId)) {
    return NextResponse.json({ error: "Invalid hive ID", data: null }, { status: 400 });
  }

  await connectDB();

  // Verify ownership of the workspace
  const hive = await Hive.findOne({
    _id: new mongoose.Types.ObjectId(hiveId),
    ownerId: new mongoose.Types.ObjectId(session.user.id),
  });

  if (!hive) {
    return NextResponse.json({ error: "Hive not found or unauthorized", data: null }, { status: 404 });
  }

  const url = new URL(request.url);
  const timestampStr = url.searchParams.get("timestamp");

  if (timestampStr) {
    reqLogger.info(`Reconstructing graph state for hive ${hiveId} at timestamp: ${timestampStr}`);
    // Reconstruct graph state at a specific historical point in time
    const targetTime = new Date(timestampStr);
    if (isNaN(targetTime.getTime())) {
      return NextResponse.json({ error: "Invalid timestamp format" }, { status: 400 });
    }
    const state = await reconstructStateAt(hiveId, targetTime);
    return NextResponse.json({ data: state, error: null }, { status: 200 });
  }

  reqLogger.info(`Fetching chronological graph mutation logs for hive ${hiveId}`);
  // Default: fetch the mutation events log chronologically
  const events = await GraphMutationEvent.find({
    hiveId: new mongoose.Types.ObjectId(hiveId),
  })
    .sort({ timestamp: 1 })
    .exec();

  return NextResponse.json({ data: events, error: null }, { status: 200 });
});
