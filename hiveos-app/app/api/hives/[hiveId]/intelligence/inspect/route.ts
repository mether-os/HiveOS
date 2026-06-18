import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Hive from "@/server/models/Hive";
import { getEntityContext } from "@/server/utils/unifiedContext";
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

    const url = new URL(request.url);
    const entityId = url.searchParams.get("entityId");
    const entityType = url.searchParams.get("entityType") as any;

    if (!entityId || !entityType) {
      return NextResponse.json({ error: "entityId and entityType query parameters are required" }, { status: 400 });
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

    const context = await getEntityContext(hiveId, entityType, entityId);
    if (!context) {
      return NextResponse.json({ error: "Entity context not found" }, { status: 404 });
    }

    return NextResponse.json({ data: context, error: null }, { status: 200 });
  } catch (err: any) {
    console.error("[GET /api/hives/[hiveId]/intelligence/inspect]", err);
    return NextResponse.json({ error: "Internal server error", message: err.message }, { status: 500 });
  }
}
