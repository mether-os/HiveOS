/**
 * lib/query-client.ts — React Query Client Factory
 *
 * Purpose: Creates and exports a singleton React Query client with
 *          production-appropriate defaults for HiveOS.
 *
 * Why React Query alongside Zustand?
 * These solve different problems:
 * - React Query: server state (data from APIs) — caching, refetching, mutations
 * - Zustand: client state (UI state) — sidebar open/close, modal visibility, etc.
 * Never use React Query for UI state. Never use Zustand for API data.
 *
 * Why a factory function instead of a direct export?
 * Next.js App Router creates the React Query client on the server for
 * server components, and on the browser for client components. We need a
 * fresh client per request on the server. The factory pattern handles this.
 *
 * Stale time decisions:
 * - Hives list: 60s — hives don't change frequently, acceptable staleness
 * - Single hive: 30s — workspace data should be more fresh
 * - Mutation side effects: immediately invalidate affected queries
 *
 * Interactions:
 * - Imported by: app/layout.tsx (wrapped in <QueryClientProvider>)
 * - Used by: features/hives/hooks/useHives.ts
 */

import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 60 seconds — won't refetch during this window
        staleTime: 60 * 1000,

        // Keep data in cache for 5 minutes after component unmounts
        gcTime: 5 * 60 * 1000,

        // Retry failed requests once (not 3 times — API failures should surface quickly)
        retry: 1,

        // Don't refetch on window focus in dev — too noisy
        // Set to true in production for real-time freshness
        refetchOnWindowFocus: process.env.NODE_ENV === "production",
      },
      mutations: {
        // Mutations don't retry by default — idempotency is not guaranteed
        retry: 0,
      },
    },
  });
}

// Singleton for browser use — avoids creating a new client on every render
let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: always create a new client (fresh per request)
    return makeQueryClient();
  }

  // Browser: create once and reuse
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
