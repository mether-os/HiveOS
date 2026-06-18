/**
 * lib/auth.ts — Better Auth Server Configuration
 *
 * Purpose: Single server-side instance of Better Auth. Defines all OAuth
 *          providers, session config, database adapter, and trusted origins.
 *
 * Why a dedicated file? Better Auth's betterAuth() call is expensive —
 * it initializes database connections, loads providers, and sets up crypto.
 * Creating it once at module level means it's instantiated once per process.
 *
 * Why Better Auth over NextAuth v5?
 * - Better TypeScript generics — auth.api.getSession() is fully typed
 * - Framework-agnostic — same config works in Next.js, Express, Hono
 * - Cleaner plugin system for future additions (2FA, magic links, etc.)
 * - Single handler pattern — one catch-all route handles all auth endpoints
 *
 * Flow:
 * 1. Browser POST to /api/auth/signin/github
 * 2. Better Auth handles OAuth redirect to GitHub
 * 3. GitHub redirects to /api/auth/callback/github
 * 4. Better Auth validates code, fetches user profile
 * 5. Better Auth upserts user in MongoDB via mongodbAdapter
 * 6. Better Auth creates session, sets cookie
 * 7. Browser redirected to BETTER_AUTH_URL (dashboard)
 *
 * Interactions:
 * - Imported by: app/api/auth/[...all]/route.ts (as request handler)
 * - Imported by: middleware.ts (for session validation)
 * - Imported by: all app/api route files (for getSession calls)
 * - Never imported by: client components (use lib/auth-client.ts instead)
 */

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

// ---------------------------------------------------------------------------
// Validate required environment variables at startup
// ---------------------------------------------------------------------------
const requiredEnvVars = [
  "BETTER_AUTH_SECRET",
  "MONGODB_URI",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(
      `[HiveOS Auth] Missing required environment variable: ${envVar}\n` +
        `Add it to your .env.local file.`
    );
  }
}

// ---------------------------------------------------------------------------
// MongoDB client for Better Auth adapter
// Better Auth's MongoDB adapter requires a MongoClient (not Mongoose).
// We keep them separate: Mongoose for our models, MongoClient for Better Auth.
// ---------------------------------------------------------------------------
const mongoClient = new MongoClient(process.env.MONGODB_URI!);

// ---------------------------------------------------------------------------
// Better Auth instance — single export used throughout the server
// ---------------------------------------------------------------------------
export const auth = betterAuth({
  // -------------------------------------------------------------------------
  // Core config
  // -------------------------------------------------------------------------
  secret: process.env.BETTER_AUTH_SECRET!,

  // Base URL — used for constructing OAuth callback URLs
  // In production, set BETTER_AUTH_URL to your actual domain
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

  // -------------------------------------------------------------------------
  // Database adapter — connects Better Auth to our MongoDB instance
  // Better Auth will create its own collections (user, session, account)
  // alongside our Hive collection in the same database.
  // -------------------------------------------------------------------------
  database: mongodbAdapter(mongoClient.db(), {
    client: mongoClient,
  }),

  // -------------------------------------------------------------------------
  // OAuth Providers
  // -------------------------------------------------------------------------
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },

    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  // -------------------------------------------------------------------------
  // Session configuration
  // -------------------------------------------------------------------------
  session: {
    // Session expiry — 7 days, refreshed on each authenticated request
    expiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
    // Sliding window — session renewed when more than 50% expired
    updateAge: 60 * 60 * 24, // refresh after 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // cache session for 5 minutes to reduce DB reads
    },
  },

  // -------------------------------------------------------------------------
  // Email/password disabled — OAuth only in V1
  // -------------------------------------------------------------------------
  emailAndPassword: {
    enabled: false,
  },

  // -------------------------------------------------------------------------
  // Advanced options
  // -------------------------------------------------------------------------
  advanced: {
    // Disable strict origin check ONLY in local development to prevent 403 Forbidden
    // errors when running on alternate ports (e.g. port 3001).
    disableOriginCheck: process.env.NODE_ENV === "development",
  },

  // -------------------------------------------------------------------------
  // Trusted origins — add production domain here when deploying
  // -------------------------------------------------------------------------
  trustedOrigins: [
    "http://localhost:3000",
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ],
});

// ---------------------------------------------------------------------------
// Type exports — used throughout the app for session typing
// ---------------------------------------------------------------------------
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
