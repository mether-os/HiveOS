import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import HiveMindRecommendation from "@/server/models/HiveMindRecommendation";
import mongoose from "mongoose";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ hiveId: string; recId: string }> }
) {
  try {
    await connectDB();
    const { hiveId, recId } = await params;
    const body = await request.json();
    const { status, userId } = body;

    if (!recId || !status) {
      return NextResponse.json({ error: "Missing recId or status" }, { status: 400 });
    }

    if (!["active", "accepted", "dismissed", "completed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const updateFields: Record<string, any> = { status };
    const now = new Date();

    if (status === "accepted") {
      updateFields.acceptedAt = now;
    } else if (status === "dismissed") {
      updateFields.dismissedAt = now;
    } else if (status === "completed") {
      updateFields.completedAt = now;
      if (userId) {
        updateFields.completedBy = new mongoose.Types.ObjectId(userId);
      }
    }

    const updated = await HiveMindRecommendation.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(recId),
        hiveId: new mongoose.Types.ObjectId(hiveId),
      },
      { $set: updateFields },
      { new: true }
    ).exec();

    if (!updated) {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    console.error("[Recommendations API] Error updating status:", err);
    return NextResponse.json(
      { error: "Internal Server Error", details: err.message },
      { status: 500 }
    );
  }
}

