import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Hive from "@/server/models/Hive";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import {
  getConnectedNodes,
  getDependencyChain,
  getDownstreamImpact,
  getUpstreamRequirements,
  getOrphanNodes,
  getShortestPath,
  getConnectedComponents,
} from "@/server/utils/graphEngine";
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

  // Verify ownership
  const hive = await Hive.findOne({
    _id: new mongoose.Types.ObjectId(hiveId),
    ownerId: new mongoose.Types.ObjectId(session.user.id),
  });

  if (!hive) {
    return NextResponse.json({ error: "Hive not found or unauthorized", data: null }, { status: 404 });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const nodeId = url.searchParams.get("nodeId");

  reqLogger.info(`Executing graph traversal type="${type}" nodeId="${nodeId}" in hive ${hiveId}`);

  let data: any = null;

  switch (type) {
    case "neighbors":
      if (!nodeId) return NextResponse.json({ error: "Missing nodeId parameter" }, { status: 400 });
      data = await getConnectedNodes(hiveId, nodeId);
      break;
    case "dependencies":
      if (!nodeId) return NextResponse.json({ error: "Missing nodeId parameter" }, { status: 400 });
      data = await getDependencyChain(hiveId, nodeId);
      break;
    case "impact":
      if (!nodeId) return NextResponse.json({ error: "Missing nodeId parameter" }, { status: 400 });
      data = await getDownstreamImpact(hiveId, nodeId);
      break;
    case "requirements":
      if (!nodeId) return NextResponse.json({ error: "Missing nodeId parameter" }, { status: 400 });
      data = await getUpstreamRequirements(hiveId, nodeId);
      break;
    case "orphans":
      data = await getOrphanNodes(hiveId);
      break;
    case "components":
      data = await getConnectedComponents(hiveId);
      break;
    case "shortestPath":
      const startId = url.searchParams.get("startId");
      const endId = url.searchParams.get("endId");
      if (!startId || !endId) {
        return NextResponse.json({ error: "Missing startId or endId parameter" }, { status: 400 });
      }
      data = await getShortestPath(hiveId, startId, endId);
      break;
    default:
      return NextResponse.json({ error: `Unsupported traversal type: ${type}` }, { status: 400 });
  }

  return NextResponse.json({ data, error: null }, { status: 200 });
});
