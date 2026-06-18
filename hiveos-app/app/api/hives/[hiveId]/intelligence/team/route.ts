import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getProjectContext } from "@/server/utils/unifiedContext";
import { getTeamIntelligence } from "@/server/utils/hiveMindService";
import { wrapApiRoute } from "@/lib/apiWrapper";

export const GET = wrapApiRoute(async (request, { params }, reqLogger) => {
  await connectDB();
  const { hiveId } = await params;

  if (!hiveId) {
    return NextResponse.json({ error: "Missing hiveId" }, { status: 400 });
  }

  reqLogger.info(`Fetching team intelligence for hive: ${hiveId}`);
  
  // Get all nodes in project context
  const context = await getProjectContext(hiveId);
  const nodes = context.nodes || [];

  const teamIntel = await getTeamIntelligence(hiveId, nodes);

  return NextResponse.json({ data: teamIntel });
});
