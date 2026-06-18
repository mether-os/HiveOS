/**
 * lib/db.ts — MongoDB Connection Singleton
 *
 * Purpose: Establishes and maintains a single MongoDB connection across the
 *          entire application lifetime. Returns a cached connection on subsequent calls.
 *
 * Why a singleton? Next.js in development hot-reloads modules constantly.
 * Without caching, each reload would open a new connection, quickly exhausting
 * MongoDB's connection pool limit (typically 100 connections for free Atlas tiers).
 *
 * Pattern used: Module-level global cache on the `global` object.
 * `global` persists across hot-reloads in the Node.js process, whereas module
 * scope is reset on each reload.
 *
 * Why Mongoose over the native MongoDB driver?
 * - Schema validation at the application layer
 * - TypeScript integration via generics (HydratedDocument<T>)
 * - Built-in timestamps, virtuals, middleware hooks
 * - Cleaner query API for our use cases
 *
 * Interactions:
 * - Imported by: server/models/*.ts (implicitly via model registration)
 * - Imported by: app/api/[...]/route.ts (explicitly before any DB query)
 * - Never imported by: client components (enforced by TypeScript + Next.js)
 */

import mongoose from "mongoose";

// Import all models to ensure they register schemas with Mongoose
import "@/server/models/Hive";
import "@/server/models/CanvasNode";
import "@/server/models/CanvasEdge";
import "@/server/models/Document";
import "@/server/models/DocumentVersion";
import "@/server/models/Activity";
import "@/server/models/GithubEvent";
import "@/server/models/ProcessedWebhookEvent";
import "@/server/models/GraphMutationEvent";
import "@/server/models/KnowledgeIndex";
import "@/server/models/SearchMetric";
import "@/server/models/HiveMindRecommendation";
import "@/server/models/HiveMindMission";
import "@/server/models/HiveMindSnapshot";
import "@/server/models/Workflow";
import "@/server/models/WorkflowRun";
import "@/server/models/AgentInstance";
import "@/server/models/ChatMetric";
import "@/server/models/ChatMessage";

// ---------------------------------------------------------------------------
// Type augmentation — adds our cache to the Node.js global type
// This prevents TypeScript from complaining about `global.mongoose`
// ---------------------------------------------------------------------------
declare global {
  var _mongooseCache:
    | {
        conn: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
      }
    | undefined;
  var _mongooseIndexesSynced: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Validate environment variable at module load time
// Fail fast: better to crash on startup than silently fail on first DB call
// ---------------------------------------------------------------------------
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "[HiveOS] MONGODB_URI is not defined. " +
      "Add it to your .env.local file.\n" +
      "Example: MONGODB_URI=mongodb://localhost:27017/hiveos"
  );
}

// ---------------------------------------------------------------------------
// Module-level cache — persists across Next.js hot reloads
// ---------------------------------------------------------------------------
const cached = (global._mongooseCache ??= { conn: null, promise: null });

/**
 * syncIndexesSafely — Helper to log index changes and safely synchronize Mongoose models.
 * Prevents accidental drops in production and logs difference.
 */
async function syncIndexesSafely(Model: mongoose.Model<any>) {
  try {
    const modelName = Model.modelName;
    const diff = await Model.diffIndexes();
    const { toCreate, toDrop } = diff;
    const isProduction = process.env.NODE_ENV === "production";

    console.log(`[Index Sync] Model: ${modelName}`);

    if (toCreate.length > 0) {
      console.log(`  -> CREATE: Indexes to be created:`, JSON.stringify(toCreate, null, 2));
    }
    
    if (toDrop.length > 0) {
      console.warn(`  -> DROP WARNING: Indexes not defined in schema (to be removed):`, JSON.stringify(toDrop, null, 2));
    }

    if (isProduction) {
      if (toCreate.length > 0) {
        // Safe creation: createIndexes does not drop existing indexes
        await Model.createIndexes();
        console.log(`  -> Successfully created new indexes for ${modelName} in background.`);
      } else {
        console.log(`  -> No indexes to create for ${modelName} in production.`);
      }
      if (toDrop.length > 0) {
        console.warn(`  -> PREVENTED DROP: Index drop phase was bypassed in production to prevent accidental loss of indexes.`);
      }
    } else {
      // Call syncIndexes with background options so it does not block the thread in non-production environments
      await Model.syncIndexes({ background: true });
      console.log(`  -> Successfully synchronized indexes for ${modelName}.`);
    }
  } catch (err: any) {
    console.error(`  -> Failed index sync/creation for ${Model.modelName}:`, err.message);
  }
}

/**
 * connectDB — Connect to MongoDB, returning a cached connection if available.
 *
 * Usage:
 * ```ts
 * import connectDB from "@/lib/db";
 * await connectDB();
 * // Now safe to use Mongoose models
 * ```
 */
export async function connectDB(): Promise<typeof mongoose> {
  // Return cached connection immediately — no round trip needed
  if (cached.conn) {
    return cached.conn;
  }

  // Create a new connection promise if one isn't in flight
  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      // Buffer commands until connection is established (prevents race conditions
      // during cold starts when multiple requests arrive simultaneously)
      bufferCommands: false,

      // Connection pool size — 10 is appropriate for serverless/edge deployments
      // Increase for dedicated servers
      maxPoolSize: 10,
    };

    cached.promise = mongoose
      .connect(MONGODB_URI!, opts)
      .then(async (mongooseInstance) => {
        console.log("[HiveOS DB] Connected to MongoDB");

        // 1. Programmatically deploy indexes on raw Better Auth collections
        const db = mongooseInstance.connection.db;
        if (db) {
          try {
            console.log("[HiveOS DB] Ensuring Better Auth collection indexes...");
            await db.collection("session").createIndex({ token: 1 });
            await db.collection("user").createIndex({ id: 1 });
            await db.collection("user").createIndex({ email: 1 });
            await db.collection("account").createIndex({ userId: 1 });
            console.log("[HiveOS DB] Better Auth collection indexes verified.");
          } catch (e: any) {
            console.warn("[HiveOS DB] Better Auth indexes check failed:", e.message);
          }
        }

        // 2. Programmatically synchronize Mongoose schemas once per Node lifecycle
        if (!global._mongooseIndexesSynced) {
          global._mongooseIndexesSynced = true;
          console.log("[HiveOS DB] Bootstrapping model index synchronizer...");
          
          const modelsToSync = [
            "Hive",
            "CanvasNode",
            "CanvasEdge",
            "Document",
            "DocumentVersion",
            "Activity",
            "GithubEvent",
            "ProcessedWebhookEvent",
            "GraphMutationEvent",
            "KnowledgeIndex",
            "SearchMetric",
            "HiveMindRecommendation",
            "HiveMindSnapshot",
            "HiveMindMission",
            "Workflow",
            "WorkflowRun",
            "AgentInstance",
            "ChatMetric",
            "ChatMessage"
          ];

          // Run sync safety checks asynchronously in background
          Promise.all(
            modelsToSync.map((name) => {
              const Model = mongooseInstance.model(name);
              return syncIndexesSafely(Model);
            })
          ).then(() => {
            console.log("[HiveOS DB] All Mongoose model indexes synchronized safely.");
          }).catch((err) => {
            console.error("[HiveOS DB] Mongoose index synchronization background run error:", err);
          });
        }

        return mongooseInstance;
      })
      .catch((err) => {
        // Reset promise so next call retries
        cached.promise = null;
        console.error("[HiveOS DB] Connection failed:", err);
        throw err;
      });
  }

  // Await the in-flight connection and cache the result
  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;
