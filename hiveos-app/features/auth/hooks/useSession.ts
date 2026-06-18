"use client";

/**
 * features/auth/hooks/useSession.ts — Session Hook Re-export
 *
 * Purpose: Wraps Better Auth's useSession with HiveOS-specific typing.
 * Components import from here instead of directly from lib/auth-client.ts —
 * this creates a stable API even if we swap auth libraries later.
 *
 * Returns:
 * - isPending: boolean — true during initial session fetch
 * - isAuthenticated: boolean — true if user has a valid session
 * - user: User | null — the current user's data
 * - session: Session | null — the raw session object
 *
 * Interactions:
 * - Used by: components/layout/TopBar.tsx (avatar, sign out)
 * - Used by: app/(dashboard)/dashboard/page.tsx (user greeting)
 */

import { useSession as useBetterAuthSession } from "@/lib/auth-client";

export function useSession() {
  const { data: session, isPending, error } = useBetterAuthSession();

  return {
    isPending,
    error,
    isAuthenticated: !!session,
    user: session?.user ?? null,
    session: session ?? null,
  };
}
