import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import IntelligenceNotification from "@/server/models/IntelligenceNotification";
import mongoose from "mongoose";
import { wrapApiRoute } from "@/lib/apiWrapper";

export const GET = wrapApiRoute(async (request, { params }, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;

  if (!hiveId) {
    return NextResponse.json({ error: "Missing hiveId" }, { status: 400 });
  }

  reqLogger.info(`Fetching active unread notifications for hive: ${hiveId}`);
  const notifications = await IntelligenceNotification.find({
    hiveId: new mongoose.Types.ObjectId(hiveId),
    read: false,
  })
    .sort({ lastDetectedAt: -1 })
    .lean()
    .exec();

  return NextResponse.json({ data: notifications });
});

export const PATCH = wrapApiRoute(async (request, { params }, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;
  
  if (!hiveId) {
    return NextResponse.json({ error: "Missing hiveId" }, { status: 400 });
  }

  const body = await request.json();
  const { ids } = body; // Array of notification IDs to mark as read

  reqLogger.info(`Marking notifications as read for hive: ${hiveId}`);

  if (ids && Array.isArray(ids)) {
    const objectIds = ids.map((id: string) => new mongoose.Types.ObjectId(id));
    await IntelligenceNotification.updateMany(
      {
        hiveId: new mongoose.Types.ObjectId(hiveId),
        _id: { $in: objectIds },
      },
      { $set: { read: true } }
    ).exec();
  } else {
    // If no ids provided, mark all as read
    await IntelligenceNotification.updateMany(
      {
        hiveId: new mongoose.Types.ObjectId(hiveId),
        read: false,
      },
      { $set: { read: true } }
    ).exec();
  }

  return NextResponse.json({ success: true });
});
