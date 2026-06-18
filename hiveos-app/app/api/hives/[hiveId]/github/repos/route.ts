import { auth } from "@/lib/auth";
import connectDB from "@/lib/db";
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

    await connectDB();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: "Database not connected", data: null }, { status: 500 });
    }

    // Query Better Auth account collection to find the linked GitHub account
    const account = await db.collection("account").findOne({
      providerId: "github",
      $or: [
        { userId: session.user.id },
        { userId: new mongoose.Types.ObjectId(session.user.id) },
      ],
    });

    if (!account || !account.accessToken) {
      return NextResponse.json(
        { error: "github_not_connected", message: "GitHub account not connected" },
        { status: 400 }
      );
    }

    // Fetch user repositories from GitHub
    const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "HiveOS-App",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[GitHub API Error]", res.status, errText);
      return NextResponse.json(
        { error: "github_api_error", message: `Failed to fetch from GitHub: ${res.statusText}` },
        { status: res.status }
      );
    }

    const repos = await res.json();
    
    // Map to a lightweight structure suitable for dropdowns and selectors
    const data = repos.map((r: any) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      owner: r.owner.login,
      private: r.private,
      description: r.description,
      htmlUrl: r.html_url,
    }));

    return NextResponse.json({ data, error: null }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/hives/[hiveId]/github/repos]", err);
    return NextResponse.json({ error: "Internal server error", data: null }, { status: 500 });
  }
}
