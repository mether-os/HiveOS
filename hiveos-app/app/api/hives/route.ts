/**
 * app/api/hives/route.ts — Hive Collection Endpoints
 *
 * Endpoints:
 *   GET  /api/hives   → List all hives owned by the current user
 *   POST /api/hives   → Create a new hive
 *
 * Architecture:
 * Route handler → (auth check) → (Zod validation) → action → response
 *
 * Why Zod validation here and not in actions?
 * Actions operate on already-validated data. Routes are the entry point
 * from untrusted client requests and are responsible for validation.
 * This separation means actions can be called safely from anywhere.
 *
 * Response format: All responses follow { data, error } structure.
 * Consistent API contracts make the client-side much simpler.
 *
 * Interactions:
 * - Imports: lib/auth.ts (session), server/actions/hives.ts (DB)
 * - Called by: features/hives/hooks/useHives.ts (via fetch)
 */

import { auth } from "@/lib/auth";
import {
  createHive,
  getUserHives,
} from "@/server/actions/hives";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Validation schema for POST /api/hives
// ---------------------------------------------------------------------------
const CreateHiveSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(50, "Name cannot exceed 50 characters")
    .trim(),

  description: z
    .string()
    .max(500, "Description cannot exceed 500 characters")
    .trim()
    .optional(),
});

// ---------------------------------------------------------------------------
// GET /api/hives — List user's hives
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    // Get session from cookie — headers() provides the request headers
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", data: null },
        { status: 401 }
      );
    }

    const hives = await getUserHives(session.user.id);

    return NextResponse.json({ data: hives, error: null }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/hives]", err);
    return NextResponse.json(
      { error: "Internal server error", data: null },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/hives — Create a new hive
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", data: null },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body: unknown = await request.json();
    const parsed = CreateHiveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
          data: null,
        },
        { status: 422 }
      );
    }

    const hive = await createHive({
      name: parsed.data.name,
      description: parsed.data.description,
      ownerId: session.user.id,
    });

    return NextResponse.json({ data: hive, error: null }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/hives]", err);
    return NextResponse.json(
      { error: "Internal server error", data: null },
      { status: 500 }
    );
  }
}
