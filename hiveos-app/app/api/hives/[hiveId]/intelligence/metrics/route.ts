import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Hive from "@/server/models/Hive";
import SearchMetric from "@/server/models/SearchMetric";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{ hiveId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { hiveId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized", data: null }, { status: 401 });
    }

    if (!mongoose.Types.ObjectId.isValid(hiveId)) {
      return NextResponse.json({ error: "Invalid Hive ID", data: null }, { status: 400 });
    }

    await connectDB();

    // Verify ownership
    const hive = await Hive.findOne({
      _id: new mongoose.Types.ObjectId(hiveId),
      ownerId: new mongoose.Types.ObjectId(session.user.id),
    });

    if (!hive) {
      return NextResponse.json({ error: "Hive not found or unauthorized", data: null }, { status: 404 });
    }

    const hiveObjectId = new mongoose.Types.ObjectId(hiveId);

    // 1. Most searched terms
    const topSearches = await SearchMetric.aggregate([
      { $match: { hiveId: hiveObjectId } },
      { $group: { _id: "$query", count: { $sum: 1 }, avgLatency: { $avg: "$latencyMs" } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // 2. Performance overview (average latency and volume)
    const stats = await SearchMetric.aggregate([
      { $match: { hiveId: hiveObjectId } },
      {
        $group: {
          _id: null,
          avgLatency: { $avg: "$latencyMs" },
          maxLatency: { $max: "$latencyMs" },
          totalSearches: { $sum: 1 }
        }
      }
    ]);

    // 3. Recent queries log
    const recentQueries = await SearchMetric.find({ hiveId: hiveObjectId })
      .sort({ timestamp: -1 })
      .limit(20)
      .exec();

    return NextResponse.json({
      data: {
        topSearches: topSearches.map(t => ({ query: t._id, count: t.count, avgLatency: Math.round(t.avgLatency) })),
        overview: stats[0] ? {
          avgLatency: Math.round(stats[0].avgLatency),
          maxLatency: stats[0].maxLatency,
          totalSearches: stats[0].totalSearches
        } : { avgLatency: 0, maxLatency: 0, totalSearches: 0 },
        recentQueries
      },
      error: null
    }, { status: 200 });

  } catch (err: any) {
    console.error("[GET /api/hives/[hiveId]/intelligence/metrics]", err);
    return NextResponse.json({ error: "Internal server error", message: err.message }, { status: 500 });
  }
}
