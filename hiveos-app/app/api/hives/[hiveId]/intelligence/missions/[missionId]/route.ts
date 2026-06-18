import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import HiveMindMission from "@/server/models/HiveMindMission";
import mongoose from "mongoose";
import { wrapApiRoute } from "@/lib/apiWrapper";

export const PATCH = wrapApiRoute(async (request, { params }, reqLogger) => {
  await connectDB();
  const { hiveId, missionId } = await params;
  const body = await request.json();
  const { status, assignedTo, assigneeName, reviewedBy, reviewNotes } = body;

  if (!hiveId || !missionId) {
    return NextResponse.json({ error: "Missing hiveId or missionId" }, { status: 400 });
  }

  if (!status) {
    return NextResponse.json({ error: "Missing status" }, { status: 400 });
  }

  if (!["pending", "assigned", "completed", "reviewed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
  }

  reqLogger.info(`Updating mission ${missionId} for hive ${hiveId} to status: ${status}`);

  const updateFields: Record<string, any> = { status };

  if (status === "assigned") {
    if (!assignedTo) {
      return NextResponse.json({ error: "Missing assignedTo user ID" }, { status: 400 });
    }
    updateFields.assignedTo = new mongoose.Types.ObjectId(assignedTo);
    if (assigneeName) {
      updateFields.assigneeName = assigneeName;
    }
  } else if (status === "completed") {
    updateFields.completedAt = new Date();
  } else if (status === "reviewed") {
    if (!reviewedBy) {
      return NextResponse.json({ error: "Missing reviewedBy user ID" }, { status: 400 });
    }
    updateFields.reviewedBy = new mongoose.Types.ObjectId(reviewedBy);
    updateFields.reviewedAt = new Date();
    if (reviewNotes) {
      updateFields.reviewNotes = reviewNotes;
    }
  }

  const updatedMission = await HiveMindMission.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(missionId),
      hiveId: new mongoose.Types.ObjectId(hiveId),
    },
    { $set: updateFields },
    { new: true }
  ).exec();

  if (!updatedMission) {
    return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: updatedMission });
});
