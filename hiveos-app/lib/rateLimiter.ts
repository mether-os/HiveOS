import redis from "./redis";
import { logger } from "./logger";

// Augment global type for memory cache
declare global {
  var _memoryRateLimiterCache: Record<string, number[]> | undefined;
}

if (!global._memoryRateLimiterCache) {
  global._memoryRateLimiterCache = {};
}

/**
 * checkRateLimit — Enforces rate limiting on API keys
 * Enforces sliding window rate limits using Redis or memory fallback.
 */
export async function checkRateLimit(
  key: string,
  limit: number = 60,
  windowSeconds: number = 60
): Promise<{ success: boolean; limit: number; remaining: number }> {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  // 1. Try Redis first
  if (redis && redis.status === "ready") {
    try {
      const multi = redis.multi();
      multi.zremrangebyscore(key, "-inf", windowStart);
      multi.zadd(key, now.toString(), now);
      multi.zcard(key);
      multi.expire(key, windowSeconds);

      const results = await multi.exec();
      if (results && results[2]) {
        const count = results[2][1] as number;
        const success = count <= limit;
        return {
          success,
          limit,
          remaining: Math.max(0, limit - count),
        };
      }
    } catch (err: any) {
      // Failed to execute on Redis. Continue to memory fallback
      logger.warn(`Redis rate limit transaction execution failed: ${err.message}`);
    }
  }

  // 2. Fallback: In-memory sliding window
  // Print warning log required: [RATE_LIMIT_FALLBACK_ACTIVE]
  console.warn(`[RATE_LIMIT_FALLBACK_ACTIVE] Redis is unavailable. Memory-based sliding window rate limiter activated for key "${key}".`);

  const cache = global._memoryRateLimiterCache!;
  if (!cache[key]) {
    cache[key] = [];
  }

  // Prune timestamps older than window start
  cache[key] = cache[key].filter((t) => t > windowStart);

  // Add current request timestamp
  cache[key].push(now);

  const count = cache[key].length;
  const success = count <= limit;

  return {
    success,
    limit,
    remaining: Math.max(0, limit - count),
  };
}
