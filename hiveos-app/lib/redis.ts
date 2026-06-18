import Redis from "ioredis";

declare global {
  var _redisClient: Redis | undefined;
}

const REDIS_URL = process.env.REDIS_URL;

let redis: Redis | null = null;

if (REDIS_URL) {
  if (!global._redisClient) {
    console.log(`[Redis] Connecting to Redis at ${REDIS_URL}...`);
    global._redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 2,
      connectTimeout: 3000,
    });
    
    global._redisClient.on("error", (err) => {
      console.warn("[Redis] Client connection error:", err.message);
    });
    
    global._redisClient.on("connect", () => {
      console.log("[Redis] Connected to Redis successfully.");
    });
  }
  redis = global._redisClient;
} else {
  console.warn(
    "[Redis] REDIS_URL is not set. Webhook events will save to MongoDB but will not broadcast live to the realtime-server."
  );
}

export { redis };
export default redis;
