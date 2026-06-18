import { NextRequest, NextResponse } from "next/server";
import { logger, type LoggerInstance } from "./logger";

export type ApiRouteHandler = (
  request: NextRequest,
  context: any,
  reqLogger: LoggerInstance
) => Promise<NextResponse>;

import { checkRateLimit } from "./rateLimiter";

export function wrapApiRoute(handler: ApiRouteHandler) {
  return async (request: NextRequest, context: any) => {
    const start = performance.now();
    
    // Get request ID from headers or generate new UUID fallback
    let requestId = request.headers.get("x-request-id");
    if (!requestId) {
      if (typeof crypto !== "undefined" && crypto.randomUUID) {
        requestId = crypto.randomUUID();
      } else {
        requestId = "req-" + Math.random().toString(36).substring(2, 15) + "-" + Date.now();
      }
    }

    const reqLogger = logger.child({ requestId });
    const url = new URL(request.url);

    reqLogger.debug(`[API Start] ${request.method} ${url.pathname}`, {
      method: request.method,
      url: url.pathname,
      search: url.search,
    });

    // Enforce Rate Limiting
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const path = url.pathname;
    
    // Webhooks have a higher threshold to handle payload bursts
    const isWebhook = path.startsWith("/api/webhooks");
    const limit = isWebhook ? 500 : 100;
    const windowSeconds = 60;
    
    const rateLimitKey = `ratelimit:${ip}:${path}`;
    const rateLimitRes = await checkRateLimit(rateLimitKey, limit, windowSeconds);

    if (!rateLimitRes.success) {
      reqLogger.warn(`Rate limit exceeded for IP: ${ip} on path: ${path} (Limit: ${limit}/min)`);
      const durationMs = performance.now() - start;
      const response = NextResponse.json(
        { error: "Too Many Requests", limit, remaining: 0 },
        { status: 429 }
      );
      response.headers.set("x-request-id", requestId!);
      response.headers.set("x-response-time-ms", durationMs.toFixed(2));
      response.headers.set("x-ratelimit-limit", limit.toString());
      response.headers.set("x-ratelimit-remaining", "0");
      return response;
    }

    try {
      const response = await handler(request, context, reqLogger);
      
      const durationMs = performance.now() - start;
      response.headers.set("x-request-id", requestId!);
      response.headers.set("x-response-time-ms", durationMs.toFixed(2));
      response.headers.set("x-ratelimit-limit", limit.toString());
      response.headers.set("x-ratelimit-remaining", rateLimitRes.remaining.toString());

      reqLogger.info(`[API Success] ${request.method} ${url.pathname} - Status: ${response.status} in ${durationMs.toFixed(2)}ms`, {
        status: response.status,
        durationMs,
        url: url.pathname,
      });

      return response;
    } catch (err: any) {
      const durationMs = performance.now() - start;
      reqLogger.error(`[API Error] Uncaught exception in ${url.pathname}: ${err.message}`, {
        error: err.message,
        stack: err.stack,
        durationMs,
        url: url.pathname,
      });

      const errorResponse = NextResponse.json(
        { error: "Internal Server Error", requestId },
        { status: 500 }
      );
      errorResponse.headers.set("x-request-id", requestId!);
      errorResponse.headers.set("x-response-time-ms", durationMs.toFixed(2));
      return errorResponse;
    }
  };
}
