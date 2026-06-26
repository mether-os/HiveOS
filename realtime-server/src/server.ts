import { createServer } from "http";
import { Server } from "socket.io";
import Redis from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import dotenv from "dotenv";
import { socketAuthMiddleware } from "./auth";
import { registerPresenceHandlers } from "./presence";
import { connectToDatabase } from "./db";

dotenv.config();

const PORT = process.env.PORT || 3002;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3001";
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const httpServer = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", service: "HiveOS Realtime Server" }));
});

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or local testing)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [CLIENT_URL, "http://localhost:3000", "http://localhost:3001"];
      const isAllowed = allowedOrigins.includes(origin) || 
                        origin.endsWith(".vercel.app") || 
                        origin.includes("mayank-sharmas-projects");
                        
      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`[Socket CORS] Connection origin blocked: ${origin}`);
        callback(new Error("CORS validation failed"));
      }
    },
    credentials: true,
  },
  pingTimeout: 30000,
  pingInterval: 10000,
});

async function main() {
  try {
    // 1. Connect to MongoDB
    console.log("[Server] Connecting to MongoDB...");
    await connectToDatabase();
    console.log("[Server] MongoDB connected successfully.");

    // 2. Set up Redis Adapter (with graceful fallback if Redis is down)
    let redisClient: Redis | null = null;
    try {
      console.log(`[Server] Attempting to connect to Redis at ${REDIS_URL}...`);
      
      const pubClient = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 1, // Fail quickly if not running
        connectTimeout: 2000,
      });
      const subClient = pubClient.duplicate();

      // Handle connection errors
      let redisConnected = true;
      pubClient.on("error", (err) => {
        if (redisConnected) {
          console.warn("[Server Redis] PubClient connection error:", err.message);
          console.warn("[Server Redis] Realtime scaling is disabled. Falling back to single-node memory adapter.");
          redisConnected = false;
        }
      });
      subClient.on("error", (err) => {
        // Ignored, pubClient error handles log
      });

      // Wait a bit to check if connection succeeds (longer timeout on Windows)
      await Promise.race([
        new Promise((resolve) => pubClient.once("ready", () => resolve(true))),
        new Promise((resolve) => setTimeout(() => resolve(false), 4000))
      ]);

      if (redisConnected && pubClient.status === "ready") {
        io.adapter(createAdapter(pubClient, subClient));
        redisClient = pubClient;
        console.log("[Server Redis] Redis Adapter configured successfully. Horizontal scaling enabled.");

        // Dedicated Redis client for custom Pub/Sub channel subscriptions
        const customSubClient = new Redis(REDIS_URL, {
          maxRetriesPerRequest: 1,
          connectTimeout: 2000,
        });

        customSubClient.on("error", (err) => {
          console.error("[Server Redis Sub] Subscription client connection error:", err.message);
        });

        customSubClient.subscribe("hiveos:activity", "hiveos:canvas", (err, count) => {
          if (err) {
            console.error("[Server Redis Sub] Failed to subscribe to channels:", err.message);
          } else {
            console.log(`[Server Redis Sub] Subscribed to channels. Active subscriptions count: ${count}`);
          }
        });

        customSubClient.on("message", (channel, message) => {
          if (channel === "hiveos:activity") {
            try {
              const data = JSON.parse(message);
              const { hiveId, activity } = data;
              if (hiveId && activity) {
                const roomName = `workspace:${hiveId}`;
                io.to(roomName).emit("activity:event", activity);
                console.log(`[Server Redis Sub] Broadcasted activity event to room '${roomName}':`, activity.title);
              }
            } catch (jsonErr: any) {
              console.error("[Server Redis Sub] Error parsing channel message JSON:", jsonErr.message);
            }
          } else if (channel === "hiveos:canvas") {
            try {
              const data = JSON.parse(message);
              const { workspaceId, event, payload } = data;
              if (workspaceId && event && payload) {
                const roomName = `workspace:${workspaceId}`;
                io.to(roomName).emit(event, payload);
                console.log(`[Server Redis Sub] Broadcasted canvas event '${event}' to room '${roomName}'`);
              }
            } catch (jsonErr: any) {
              console.error("[Server Redis Sub] Error parsing canvas message JSON:", jsonErr.message);
            }
          }
        });
      } else {
        pubClient.disconnect();
        subClient.disconnect();
        console.warn("[Server Redis] Could not connect to Redis. Defaulting to local memory adapter.");
        console.warn("[RATE_LIMIT_FALLBACK_ACTIVE] Redis is unavailable. Memory-based socket event rate limiter activated.");
      }
    } catch (redisError: any) {
      console.warn("[Server Redis] Setup failed:", redisError.message);
      console.warn("[Server Redis] Defaulting to local memory adapter.");
      console.warn("[RATE_LIMIT_FALLBACK_ACTIVE] Redis is unavailable. Memory-based socket event rate limiter activated.");
    }

    // 3. Register Socket.io Middleware for Authentication
    io.use(socketAuthMiddleware);

    // 4. Handle Connections
    io.on("connection", (socket) => {
      console.log(`[Server] Client connected: ${socket.id} (User: ${socket.data.user?.name})`);
      
      // A. Enforce In-Memory Event Rate Limiter (Max 500 events per 10 seconds per client)
      let eventCount = 0;
      let windowStart = Date.now();
      const LIMIT = 500;
      const WINDOW_MS = 10000;

      socket.use((packet, next) => {
        const now = Date.now();

        // Reset counter when window expires
        if (now - windowStart > WINDOW_MS) {
          eventCount = 0;
          windowStart = now;
        }

        if (eventCount >= LIMIT) {
          return next(new Error("rate_limit_exceeded"));
        }

        eventCount++;
        next();
      });

      // B. Enforce Dynamic Session Revocation Checks (Every 30 seconds)
      const actualToken = socket.data.sessionToken;
      let sessionInterval: NodeJS.Timeout | null = null;

      if (actualToken) {
        sessionInterval = setInterval(async () => {
          try {
            const db = await connectToDatabase();
            const session = await db.collection("session").findOne({ token: actualToken });

            if (!session || new Date(session.expiresAt) < new Date()) {
              console.log(`[Server] Session revoked or expired for user ${socket.data.user?.name}. Disconnecting socket ${socket.id}`);
              if (sessionInterval) clearInterval(sessionInterval);
              socket.disconnect(true);
            }
          } catch (err: any) {
            console.error(`[Server] Error checking session revocation for socket ${socket.id}:`, err.message);
          }
        }, 30000);
      }

      socket.on("disconnect", () => {
        if (sessionInterval) {
          clearInterval(sessionInterval);
          console.log(`[Server] Cleared session validation timer for disconnected socket ${socket.id}`);
        }
      });

      // Register presence, typing, and room listeners
      registerPresenceHandlers(io, socket, redisClient);
    });

    // 5. Start Server
    httpServer.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(`  HiveOS Realtime Server running on PORT ${PORT}`);
      console.log(`  CORS allowed for: ${CLIENT_URL}`);
      console.log(`=========================================`);
    });

  } catch (error) {
    console.error("[Server] Critical startup error:", error);
    process.exit(1);
  }
}

// Global exception handling to prevent server crashes
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Unhandled Rejection] at:", promise, "reason:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[Uncaught Exception] thrown:", error);
});

main();
