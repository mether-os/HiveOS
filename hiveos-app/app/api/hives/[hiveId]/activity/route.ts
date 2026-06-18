import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Hive from "@/server/models/Hive";
import Activity from "@/server/models/Activity";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hiveId: string }> }
) {
  try {
    const { hiveId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

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

    // Parse limit and cursor parameters
    const url = new URL(request.url);
    const limitVal = parseInt(url.searchParams.get("limit") || "50", 10);
    const limit = isNaN(limitVal) ? 50 : Math.min(Math.max(limitVal, 1), 100);
    const before = url.searchParams.get("before");

    const query: any = {
      hiveId: new mongoose.Types.ObjectId(hiveId),
    };

    if (before) {
      query.timestamp = { $lt: new Date(before) };
    }

    const activities = await Activity.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();

    return NextResponse.json({ data: activities, error: null }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/hives/[hiveId]/activity]", err);
    return NextResponse.json({ error: "Internal server error", data: null }, { status: 500 });
  }
}
