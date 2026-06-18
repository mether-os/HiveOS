import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import HiveMindSnapshot from "@/server/models/HiveMindSnapshot";
import mongoose from "mongoose";
import { wrapApiRoute } from "@/lib/apiWrapper";

export const GET = wrapApiRoute(async (request, { params }, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;

  if (!hiveId) {
    return NextResponse.json({ error: "Missing hiveId" }, { status: 400 });
  }

  reqLogger.info(`Comparing snapshots for hive: ${hiveId}`);
  
  // Retrieve the 2 latest snapshots
  const snapshots = await HiveMindSnapshot.find({
    hiveId: new mongoose.Types.ObjectId(hiveId),
  })
    .sort({ timestamp: -1 })
    .limit(2)
    .lean()
    .exec();

  if (snapshots.length < 1 || !snapshots[0]) {
    return NextResponse.json({ 
      data: {
        comparisonAvailable: false,
        message: "No snapshots available for comparison yet."
      } 
    });
  }

  const s1 = snapshots[0]; // Current
  const s2 = snapshots.length > 1 ? snapshots[1] : null; // Previous

  const healthScoreDiff = s2 ? s1.healthScore - s2.healthScore : 0;
  const risksCountDiff = s2 ? s1.risksCount - s2.risksCount : 0;
  const gapsCountDiff = s2 ? s1.gapsCount - s2.gapsCount : 0;
  const recommendationsCountDiff = s2 ? s1.recommendationsCount - s2.recommendationsCount : 0;

  // Compare risks
  const currentRisks = s1.risks || [];
  const prevRisks = s2 ? (s2.risks || []) : [];
  const currentRiskIds = currentRisks.map((r: any) => r.id);
  const prevRiskIds = prevRisks.map((r: any) => r.id);

  const newRisks = currentRisks.filter((r: any) => !prevRiskIds.includes(r.id));
  const resolvedRisks = prevRisks.filter((r: any) => !currentRiskIds.includes(r.id));

  // Compare gaps
  const currentGaps = s1.gaps || [];
  const prevGaps = s2 ? (s2.gaps || []) : [];
  const currentGapIds = currentGaps.map((g: any) => g.id);
  const prevGapIds = prevGaps.map((g: any) => g.id);

  const newGaps = currentGaps.filter((g: any) => !prevGapIds.includes(g.id));
  const resolvedGaps = prevGaps.filter((g: any) => !currentGapIds.includes(g.id));

  // Compare recommendations
  const currentRecs = s1.recommendations || [];
  const prevRecs = s2 ? (s2.recommendations || []) : [];
  const currentRecIds = currentRecs.map((r: any) => r._id?.toString() || r.id);
  const prevRecIds = prevRecs.map((r: any) => r._id?.toString() || r.id);

  const newRecommendations = currentRecs.filter((r: any) => !prevRecIds.includes(r._id?.toString() || r.id));
  const resolvedRecommendations = prevRecs.filter((r: any) => !currentRecIds.includes(r._id?.toString() || r.id));

  // Attribution summary
  const improvements: string[] = [];
  const regressions: string[] = [];

  resolvedRisks.forEach((r: any) => {
    improvements.push(`Resolved active risk: "${r.title}"`);
  });
  resolvedGaps.forEach((g: any) => {
    improvements.push(`Resolved documentation/link gap: "${g.title}"`);
  });

  newRisks.forEach((r: any) => {
    regressions.push(`Detected new risk: "${r.title}" (${r.reason})`);
  });
  newGaps.forEach((g: any) => {
    regressions.push(`Detected new gap: "${g.title}" (${g.description})`);
  });

  return NextResponse.json({
    data: {
      comparisonAvailable: true,
      currentSnapshot: {
        id: s1._id.toString(),
        healthScore: s1.healthScore,
        risksCount: s1.risksCount,
        gapsCount: s1.gapsCount,
        recommendationsCount: s1.recommendationsCount,
        missionsCompletionRate: s1.missionsCompletionRate,
        momentumScore: s1.momentumScore,
        timestamp: s1.timestamp
      },
      previousSnapshot: s2 ? {
        id: s2._id.toString(),
        healthScore: s2.healthScore,
        risksCount: s2.risksCount,
        gapsCount: s2.gapsCount,
        recommendationsCount: s2.recommendationsCount,
        missionsCompletionRate: s2.missionsCompletionRate,
        momentumScore: s2.momentumScore,
        timestamp: s2.timestamp
      } : null,
      diffs: {
        healthScore: healthScoreDiff,
        risksCount: risksCountDiff,
        gapsCount: gapsCountDiff,
        recommendationsCount: recommendationsCountDiff
      },
      attributions: {
        improvements,
        regressions,
        newRisks,
        resolvedRisks,
        newGaps,
        resolvedGaps,
        newRecommendations,
        resolvedRecommendations
      }
    }
  });
});

