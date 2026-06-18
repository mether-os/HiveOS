/**
 * app/api/auth/[...all]/route.ts — Better Auth Catch-All Handler
 *
 * Purpose: Routes ALL /api/auth/* requests to Better Auth's internal handler.
 * This single file handles: signin, callback, session, signout, and more.
 *
 * Why [...all]? Better Auth exposes many sub-routes:
 * - /api/auth/signin/github        → initiates GitHub OAuth
 * - /api/auth/callback/github      → handles GitHub OAuth callback
 * - /api/auth/signin/google        → initiates Google OAuth
 * - /api/auth/callback/google      → handles Google OAuth callback
 * - /api/auth/get-session          → returns current session (used by useSession)
 * - /api/auth/sign-out             → clears session cookie
 *
 * Next.js [...all] catches all of these with one file.
 *
 * Why export both GET and POST?
 * OAuth callbacks use GET (browser redirects). Sign-in, sign-out,
 * and session queries use POST. Better Auth's handler checks the method internally.
 *
 * Interactions:
 * - Imports: lib/auth.ts (server auth instance)
 * - Called by: browser (OAuth redirects), useSession hook, signIn/signOut calls
 */

import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

const { GET, POST } = toNextJsHandler(auth);

export { GET, POST };
