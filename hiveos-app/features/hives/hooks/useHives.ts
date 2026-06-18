"use client";

/**
 * features/hives/hooks/useHives.ts — React Query Hooks for Hive Operations
 *
 * Purpose: All React Query hooks for the Hive domain. Components use these
 *          hooks instead of calling fetch() directly.
 *
 * Why this pattern?
 * - Automatic caching: the hive list is cached for staleTime (60s by default)
 * - Automatic deduplication: multiple components can call useHives() and
 *   React Query only makes ONE network request
 * - Optimistic updates: useDeleteHive removes the card immediately before
 *   the server responds, making the UI feel instant
 * - Cache invalidation: after create/delete, the list is refetched to stay fresh
 *
 * Query key conventions:
 * ["hives"]           → list of all user's hives
 * ["hives", hiveId]  → single hive
 * These are invalidated precisely by key after mutations.
 *
 * Interactions:
 * - Uses: React Query (caching, mutations)
 * - Calls: /api/hives, /api/hives/:id (via fetch)
 * - Used by: features/hives/components/HiveGrid.tsx, dashboard page
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import type {
  ApiResponse,
  CreateHivePayload,
  Hive,
} from "@/features/hives/types";

// ---------------------------------------------------------------------------
// Query keys — centralized to avoid typos and enable precise invalidation
// ---------------------------------------------------------------------------
export const hiveKeys = {
  all: ["hives"] as const,
  single: (id: string) => ["hives", id] as const,
};

// ---------------------------------------------------------------------------
// API functions — thin wrappers around fetch(), not hooks
// Separating them makes them testable independently of React Query
// ---------------------------------------------------------------------------

async function fetchHives(): Promise<Hive[]> {
  const res = await fetch("/api/hives");
  const json: ApiResponse<Hive[]> = await res.json();

  if (!res.ok || json.error) {
    throw new Error(json.error ?? "Failed to fetch hives");
  }

  return json.data ?? [];
}

async function fetchHive(hiveId: string): Promise<Hive> {
  const res = await fetch(`/api/hives/${hiveId}`);
  const json: ApiResponse<Hive> = await res.json();

  if (!res.ok || json.error) {
    throw new Error(json.error ?? "Failed to fetch hive");
  }

  if (!json.data) throw new Error("Hive not found");
  return json.data;
}

async function apiCreateHive(payload: CreateHivePayload): Promise<Hive> {
  const res = await fetch("/api/hives", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json: ApiResponse<Hive> = await res.json();

  if (!res.ok || json.error) {
    throw new Error(json.error ?? "Failed to create hive");
  }

  if (!json.data) throw new Error("No hive returned from server");
  return json.data;
}

async function apiDeleteHive(hiveId: string): Promise<void> {
  const res = await fetch(`/api/hives/${hiveId}`, {
    method: "DELETE",
  });

  if (!res.ok && res.status !== 204) {
    const json: ApiResponse<null> = await res.json();
    throw new Error(json.error ?? "Failed to delete hive");
  }
}

// ---------------------------------------------------------------------------
// Hook: useHives — fetch and cache the user's hive list
// ---------------------------------------------------------------------------

export function useHives(): UseQueryResult<Hive[], Error> {
  return useQuery({
    queryKey: hiveKeys.all,
    queryFn: fetchHives,
  });
}

// ---------------------------------------------------------------------------
// Hook: useHive — fetch a single hive by ID
// ---------------------------------------------------------------------------

export function useHive(hiveId: string): UseQueryResult<Hive, Error> {
  return useQuery({
    queryKey: hiveKeys.single(hiveId),
    queryFn: () => fetchHive(hiveId),
    enabled: !!hiveId, // Don't run if hiveId is empty
  });
}

// ---------------------------------------------------------------------------
// Hook: useCreateHive — mutation with cache update
// ---------------------------------------------------------------------------

export function useCreateHive(): UseMutationResult<
  Hive,
  Error,
  CreateHivePayload
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiCreateHive,

    onSuccess: (newHive) => {
      // Optimistically add new hive to cached list without a refetch
      queryClient.setQueryData<Hive[]>(hiveKeys.all, (old) => {
        return old ? [newHive, ...old] : [newHive];
      });

      // Also cache the individual hive data
      queryClient.setQueryData(hiveKeys.single(newHive.id), newHive);
    },
  });
}

// ---------------------------------------------------------------------------
// Hook: useDeleteHive — mutation with optimistic removal
// ---------------------------------------------------------------------------

export function useDeleteHive(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: apiDeleteHive,

    // Optimistic update: remove from list immediately before server responds
    onMutate: async (hiveId) => {
      // Cancel any in-flight queries to prevent them from overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: hiveKeys.all });

      // Snapshot current data for rollback on error
      const previousHives = queryClient.getQueryData<Hive[]>(hiveKeys.all);

      // Optimistically remove the hive
      queryClient.setQueryData<Hive[]>(hiveKeys.all, (old) =>
        old?.filter((h) => h.id !== hiveId) ?? []
      );

      return { previousHives };
    },

    // On error: roll back to snapshot
    onError: (_err, _hiveId, context) => {
      const ctx = context as { previousHives?: Hive[] } | undefined;
      if (ctx?.previousHives) {
        queryClient.setQueryData(hiveKeys.all, ctx.previousHives);
      }
    },

    // On success or error: invalidate to ensure consistency with server
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: hiveKeys.all });
    },
  });
}
