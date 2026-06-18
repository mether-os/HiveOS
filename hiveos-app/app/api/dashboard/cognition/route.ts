import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Hive from "@/server/models/Hive";
import HiveMindSnapshot from "@/server/models/HiveMindSnapshot";
import { headers } from "next/headers";

/**
 * GET /api/dashboard/cognition
 * Aggregates snapshots across all hives owned by the user to provide a live Active Cognition feed.
 */
export async function GET() {
  try {
    await connectDB();

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", data: null },
        { status: 401 }
      );
    }

    const hives = await Hive.find({ ownerId: session.user.id }).lean().exec();
    
    if (hives.length === 0) {
      return NextResponse.json({
        data: {
          averageHealth: 100,
          totalRisks: 0,
          totalGaps: 0,
          latestRecommendations: [],
          totalHives: 0
        },
        error: null
      }, { status: 200 });
    }

    const snapshotPromises = hives.map(async (hive) => {
      const latestSnapshot = await HiveMindSnapshot.findOne({ hiveId: hive._id })
        .sort({ timestamp: -1 })
        .lean()
        .exec();
      return { hive, latestSnapshot };
    });

    const results = await Promise.all(snapshotPromises);

    const allRecommendations: any[] = [];
    let totalRisks = 0;
    let totalGaps = 0;
    let healthSum = 0;
    let snapshotCount = 0;

    results.forEach(({ hive, latestSnapshot }) => {
      if (latestSnapshot) {
        healthSum += latestSnapshot.healthScore;
        snapshotCount++;
        totalRisks += latestSnapshot.risksCount || 0;
        totalGaps += latestSnapshot.gapsCount || 0;

        if (Array.isArray(latestSnapshot.recommendations)) {
          latestSnapshot.recommendations.forEach((rec: any) => {
            // Include recommendation if status is active
            if (rec && rec.status === "active") {
              allRecommendations.push({
                id: rec.id || rec._id?.toString() || Math.random().toString(),
                title: rec.title || "Untitled Recommendation",
                description: rec.description || "",
                hiveId: hive._id.toString(),
                hiveName: hive.name,
                createdAt: latestSnapshot.timestamp || new Date(),
              });
            }
          });
        }
      }
    });

    const averageHealth = snapshotCount > 0 ? Math.round(healthSum / snapshotCount) : 100;
    
    // Sort merged recommendations by timestamp descending (latest first)
    allRecommendations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const latestRecommendations = allRecommendations.slice(0, 3);

    return NextResponse.json({
      data: {
        averageHealth,
        totalRisks,
        totalGaps,
        latestRecommendations,
        totalHives: hives.length
      },
      error: null
    }, { status: 200 });

  } catch (err: any) {
    console.error("[GET /api/dashboard/cognition]", err);
    return NextResponse.json(
      { error: err.message || "Internal server error", data: null },
      { status: 500 }
    );
  }
}
