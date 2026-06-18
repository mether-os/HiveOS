import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
import Hive from "@/server/models/Hive";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";

const LinkRepoSchema = z.object({
  owner: z.string().min(1, "Owner is required").trim(),
  repo: z.string().min(1, "Repo is required").trim(),
});

export async function POST(
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

    // Verify Hive ownership (only owner can modify connections)
    const hive = await Hive.findOne({
      _id: new mongoose.Types.ObjectId(hiveId),
      ownerId: new mongoose.Types.ObjectId(session.user.id),
    });

    if (!hive) {
      return NextResponse.json({ error: "Hive not found or unauthorized", data: null }, { status: 404 });
    }

    const body = await request.json();
    const parsed = LinkRepoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors, data: null },
        { status: 422 }
      );
    }

    const { owner, repo } = parsed.data;

    // Generate a secure webhook secret (if crypto.randomUUID isn't available, fallback to random hex string)
    const webhookSecret = typeof crypto.randomUUID === "function" 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

    hive.githubRepo = {
      owner,
      repo,
      webhookSecret,
      status: "connected",
      connectedAt: new Date(),
    };

    await hive.save();

    return NextResponse.json({ data: hive, error: null }, { status: 200 });
  } catch (err) {
    console.error("[POST /api/hives/[hiveId]/github/link]", err);
    return NextResponse.json({ error: "Internal server error", data: null }, { status: 500 });
  }
}

export async function DELETE(
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

    // Verify Hive ownership
    const hive = await Hive.findOne({
      _id: new mongoose.Types.ObjectId(hiveId),
      ownerId: new mongoose.Types.ObjectId(session.user.id),
    });

    if (!hive) {
      return NextResponse.json({ error: "Hive not found or unauthorized", data: null }, { status: 404 });
    }

    if (hive.githubRepo) {
      hive.githubRepo.status = "disconnected";
      await hive.save();
    }

    return NextResponse.json({ data: hive, error: null }, { status: 200 });
  } catch (err) {
    console.error("[DELETE /api/hives/[hiveId]/github/link]", err);
    return NextResponse.json({ error: "Internal server error", data: null }, { status: 500 });
  }
}
