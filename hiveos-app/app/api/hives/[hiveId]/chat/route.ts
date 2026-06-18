import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Hive from "@/server/models/Hive";
import ChatMessage from "@/server/models/ChatMessage";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{ hiveId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { hiveId } = await params;

    // 1. Authenticate user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", data: null },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    await connectDB();

    // 2. Security Check: Verify that the user belongs to the Hive (is the owner)
    const hive = await Hive.findOne({
      _id: new mongoose.Types.ObjectId(hiveId),
      ownerId: new mongoose.Types.ObjectId(userId),
    }).lean().exec();

    if (!hive) {
      return NextResponse.json(
        { error: "Hive not found or access denied", data: null },
        { status: 404 }
      );
    }

    // 3. Parse query parameters
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const beforeParam = url.searchParams.get("before");

    let limit = 50;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, 100);
      }
    }

    const query: Record<string, any> = {
      hiveId: new mongoose.Types.ObjectId(hiveId),
    };

    if (beforeParam) {
      const beforeDate = new Date(beforeParam);
      if (!isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    // 4. Fetch chat history (newest first)
    const messages = await ChatMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();

    // Transform database representation to client representation
    const formattedMessages = messages.map((msg: any) => ({
      id: msg._id.toString(),
      userId: msg.userId.toString(),
      userName: msg.userName,
      userImage: msg.userAvatar || "", // Map to userImage for frontend compatibility
      userAvatar: msg.userAvatar || "",
      text: msg.text,
      timestamp: msg.createdAt,
    }));

    return NextResponse.json(
      { data: formattedMessages, error: null },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/hives/[hiveId]/chat]", err);
    return NextResponse.json(
      { error: "Internal server error", data: null },
      { status: 500 }
    );
  }
}
