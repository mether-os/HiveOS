/**
 * app/api/hives/[hiveId]/route.ts — Individual Hive Endpoints
 *
 * Endpoints:
 *   GET    /api/hives/:hiveId   → Get a single hive by ID
 *   DELETE /api/hives/:hiveId   → Delete a hive (owner only)
 *
 * Authorization model:
 * Both endpoints verify two things:
 * 1. User is authenticated (valid session cookie)
 * 2. The hive belongs to the requesting user (ownerId === session.user.id)
 *
 * This prevents horizontal privilege escalation — User A cannot read or
 * delete User B's hives even if they know the hive ID.
 *
 * Why return 404 instead of 403 for unauthorized hive access?
 * Security best practice — don't reveal whether a resource exists to
 * unauthorized users. Return 404 for both "not found" and "not yours".
 *
 * Interactions:
 * - Imports: lib/auth.ts (session), server/actions/hives.ts (DB)
 * - Called by: features/hives/hooks/useHives.ts
 */

import { auth } from "@/lib/auth";
import { deleteHive, getHiveById } from "@/server/actions/hives";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Hive from "@/server/models/Hive";

interface RouteParams {
  params: Promise<{ hiveId: string }>;
}

// ---------------------------------------------------------------------------
// GET /api/hives/:hiveId — Get single hive
// ---------------------------------------------------------------------------

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { hiveId } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", data: null },
        { status: 401 }
      );
    }

    const hive = await getHiveById(hiveId, session.user.id);

    if (!hive) {
      // Return 404 — not 403 — see module comment above
      return NextResponse.json(
        { error: "Hive not found", data: null },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: hive, error: null }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/hives/:hiveId]", err);
    return NextResponse.json(
      { error: "Internal server error", data: null },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/hives/:hiveId — Delete a hive
// ---------------------------------------------------------------------------

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { hiveId } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", data: null },
        { status: 401 }
      );
    }

    await connectDB();

    // Verify workspace exists
    const hive = await Hive.findById(hiveId).lean().exec();
    if (!hive) {
      return NextResponse.json(
        { error: "Hive not found", data: null },
        { status: 404 }
      );
    }

    // Verify ownership
    if (hive.ownerId.toString() !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: Only the hive owner can delete a workspace", data: null },
        { status: 403 }
      );
    }

    const deleted = await deleteHive(hiveId, session.user.id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Hive not found", data: null },
        { status: 404 }
      );
    }

    // 204 No Content — successful delete with no body
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE /api/hives/:hiveId]", err);
    return NextResponse.json(
      { error: "Internal server error", data: null },
      { status: 500 }
    );
  }
}
