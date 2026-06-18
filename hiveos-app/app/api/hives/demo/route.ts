import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import connectDB from "@/lib/db";
import { auth } from "@/lib/auth";
import { seedDemoWorkspace } from "@/server/utils/demoSeeder";
import { wrapApiRoute } from "@/lib/apiWrapper";

/**
 * POST /api/hives/demo
 * Creates and seeds a comprehensive portfolio showcase workspace for the authenticated user.
 */
export const POST = wrapApiRoute(async (request: NextRequest, context, reqLogger) => {
  await connectDB();

  // Retrieve user session using Better Auth
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    reqLogger.warn("[Demo API] Request rejected: user is unauthenticated.");
    return NextResponse.json(
      { error: "Unauthorized", data: null },
      { status: 401 }
    );
  }

  const userId = session.user.id;
  reqLogger.info(`[Demo API] Seeding workspace for user: ${userId} (${session.user.email})`);

  try {
    const hiveId = await seedDemoWorkspace(userId);
    reqLogger.info(`[Demo API] Showcase workspace created successfully. Hive ID: ${hiveId}`);
    return NextResponse.json({ success: true, hiveId });
  } catch (err: any) {
    reqLogger.error(`[Demo API] Database seeding failed: ${err.message}`, {
      error: err.message,
      stack: err.stack,
    });
    return NextResponse.json(
      { error: "Seeding failed", data: null },
      { status: 500 }
    );
  }
});
