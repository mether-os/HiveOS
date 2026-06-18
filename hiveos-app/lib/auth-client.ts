/**
 * lib/auth-client.ts — Better Auth Browser Client
 *
 * Purpose: Client-side counterpart to lib/auth.ts. Used in React components
 *          and hooks to read session state and trigger auth actions.
 *
 * Why separate from lib/auth.ts?
 * lib/auth.ts imports mongoose and other Node.js-only modules. If a client
 * component imported it, Next.js would bundle Node.js code into the browser
 * bundle — causing build errors or runtime crashes.
 *
 * lib/auth-client.ts contains ZERO server imports. It communicates with
 * the auth server purely via HTTP (the /api/auth/* endpoints).
 *
 * What it provides:
 * - `useSession()` — React hook for reading current auth state
 * - `signIn.social()` — triggers OAuth flow
 * - `signOut()` — clears session
 *
 * Usage in components:
 * ```tsx
 * "use client";
 * import { authClient } from "@/lib/auth-client";
 *
 * const { data: session, isPending } = authClient.useSession();
 * // session.user.name, session.user.email, session.user.image
 * ```
 *
 * Interactions:
 * - Imported by: features/auth/components/AuthButtons.tsx
 * - Imported by: features/auth/hooks/useSession.ts
 * - Imported by: components/layout/TopBar.tsx (for sign out)
 * - Never imported by: server files (use lib/auth.ts instead)
 */

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // During client-side execution, we omit baseURL (set to undefined) so it inherits
  // the active browser origin (matching whatever dev port the app is running on).
  // During server-side rendering (SSR), we fall back to the environment variable.
  baseURL: typeof window !== "undefined" ? undefined : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
});

// ---------------------------------------------------------------------------
// Named exports for convenience — import directly instead of authClient.*
// ---------------------------------------------------------------------------
export const {
  useSession,   // React hook: { data: session, isPending, error }
  signIn,       // signIn.social({ provider: "github" | "google" })
  signOut,      // signOut() — clears session cookie, redirects
} = authClient;
