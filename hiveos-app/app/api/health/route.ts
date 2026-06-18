import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import { redis } from "@/lib/redis";

/**
 * GET /api/health
 * Health check endpoint validating connection states for MongoDB and Redis.
 */
export async function GET() {
  try {
    // 1. Verify MongoDB Connectivity
    await connectDB();
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? "connected" : "disconnected";

    // 2. Verify Redis Connectivity (if configured)
    let redisStatus = "not_configured";
    if (redis) {
      try {
        const ping = await redis.ping();
        redisStatus = ping === "PONG" ? "connected" : "disconnected";
      } catch (err: any) {
        redisStatus = `error: ${err.message}`;
      }
    }

    const isHealthy = dbState === 1 && (!redis || redisStatus === "connected");

    return NextResponse.json(
      {
        status: isHealthy ? "healthy" : "unhealthy",
        database: dbStatus,
        redis: redisStatus,
        timestamp: new Date().toISOString(),
      },
      { status: isHealthy ? 200 : 500 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: err.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
