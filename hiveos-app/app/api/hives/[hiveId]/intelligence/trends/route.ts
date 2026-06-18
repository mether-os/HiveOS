import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import HiveMindSnapshot from "@/server/models/HiveMindSnapshot";
import Activity from "@/server/models/Activity";
import mongoose from "mongoose";
import { wrapApiRoute } from "@/lib/apiWrapper";

export const GET = wrapApiRoute(async (request, { params }, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;

  if (!hiveId) {
    return NextResponse.json({ error: "Missing hiveId" }, { status: 400 });
  }

  reqLogger.info(`Fetching intelligence trend snapshots for hive: ${hiveId}`);
  
  // Retrieve last 15 snapshots sorted descending to get the latest ones
  const snapshots = await HiveMindSnapshot.find({
    hiveId: new mongoose.Types.ObjectId(hiveId),
  })
    .sort({ timestamp: -1 })
    .limit(15)
    .lean()
    .exec();

  // Reverse them to have chronological ascending order (left-to-right for charts)
  const chronologicalSnapshots = snapshots.reverse().map((snap) => ({
    id: snap._id.toString(),
    healthScore: snap.healthScore,
    risksCount: snap.risksCount,
    gapsCount: snap.gapsCount,
    recommendationsCount: snap.recommendationsCount,
    acceptedRecommendationsCount: snap.acceptedRecommendationsCount || 0,
    completedRecommendationsCount: snap.completedRecommendationsCount || 0,
    dismissedRecommendationsCount: snap.dismissedRecommendationsCount || 0,
    missionsCompletionRate: snap.missionsCompletionRate,
    momentumScore: snap.momentumScore || 100,
    timestamp: snap.timestamp,
  }));

  // Retrieve team activity trends over the last 15 days
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  fifteenDaysAgo.setHours(0, 0, 0, 0);

  const activities = await Activity.find({
    hiveId: new mongoose.Types.ObjectId(hiveId),
    timestamp: { $gte: fifteenDaysAgo },
  })
    .lean()
    .exec();

  const activityMap: Record<string, number> = {};
  for (let i = 0; i < 15; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0]!;
    activityMap[dateStr] = 0;
  }

  activities.forEach((act) => {
    const dateStr = new Date(act.timestamp).toISOString().split("T")[0]!;
    if (activityMap[dateStr] !== undefined) {
      activityMap[dateStr]++;
    }
  });


  const teamActivityTrends = Object.entries(activityMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ 
    data: {
      snapshots: chronologicalSnapshots,
      teamActivityTrends
    }
  });
});

