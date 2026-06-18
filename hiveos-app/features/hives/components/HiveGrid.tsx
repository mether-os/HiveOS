"use client";

/**
 * features/hives/components/HiveGrid.tsx — Hive Card Grid
 *
 * Purpose: Renders the full grid of Hive cards with loading skeletons,
 *          empty state, error state, and the "Initialize Hive" add card.
 *
 * States:
 * - Loading: 3 skeleton cards
 * - Error: error message with retry
 * - Empty: centered "Initialize Hive" CTA
 * - Populated: grid of HiveCard + "Initialize Hive" dashed add card
 *
 * Interactions:
 * - Uses: features/hives/hooks/useHives.ts (useHives)
 * - Uses: features/hives/components/HiveCard.tsx
 * - Used by: app/(dashboard)/dashboard/page.tsx
 */

import { HiveCard } from "@/features/hives/components/HiveCard";
import { DeleteHiveDialog } from "@/features/hives/components/DeleteHiveDialog";
import { useHives } from "@/features/hives/hooks/useHives";
import type { Hive } from "@/features/hives/types";
import { Grid3X3, Plus, RefreshCcw } from "lucide-react";
import { useState } from "react";

interface HiveGridProps {
  onCreateClick: () => void;
}

export function HiveGrid({ onCreateClick }: HiveGridProps) {
  const { data: hives, isLoading, isError, error, refetch } = useHives();
  const [deleteTarget, setDeleteTarget] = useState<Hive | null>(null);

  // -------------------------------------------------------------------------
  // Loading state — skeleton cards
  // -------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-busy="true" aria-label="Loading hives">
        {Array.from({ length: 3 }).map((_, i) => (
          <HiveCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-12 h-12 rounded-full bg-[#ef4444]/10 flex items-center justify-center">
          <RefreshCcw className="w-6 h-6 text-[#ef4444]" />
        </div>
        <p className="text-[#94a3b8] text-sm">
          Failed to load hives: {error?.message ?? "Unknown error"}
        </p>
        <button
          onClick={() => void refetch()}
          className="text-[#f5a623] text-sm hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Empty state — no hives yet
  // -------------------------------------------------------------------------
  if (!hives || hives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6 animate-fade-up">
        <div className="w-16 h-16 rounded-full bg-[#1a1f2c] border border-[#1e2533] flex items-center justify-center">
          <Grid3X3 className="w-8 h-8 text-[#475569]" />
        </div>
        <div className="text-center">
          <h3
            className="text-[#f1f5f9] font-semibold text-lg mb-2"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
          >
            No Hives yet
          </h3>
          <p className="text-[#94a3b8] text-sm">
            Create your first Hive to get started.
          </p>
        </div>
        <button
          onClick={onCreateClick}
          className="
            flex items-center gap-2 px-6 py-2.5
            bg-[#f5a623] text-[#1a0e00] font-bold text-sm rounded-lg
            hover:bg-[#e09415] active:scale-95 transition-all
          "
        >
          <Plus className="w-4 h-4" />
          Initialize First Hive
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Populated grid
  // -------------------------------------------------------------------------
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="list" aria-label="Your hives">
        {/* Hive cards */}
        {hives.map((hive) => (
          <div key={hive.id} role="listitem">
            <HiveCard hive={hive} onDelete={setDeleteTarget} />
          </div>
        ))}

        {/* "Initialize Hive" — dashed add card */}
        <button
          onClick={onCreateClick}
          className="
            group flex flex-col items-center justify-center
            border-2 border-dashed border-[#1e2533]
            hover:border-[#f5a623]/50
            p-6 rounded-xl transition-all duration-300 cursor-pointer
            min-h-[200px]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5a623] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080a0f]
          "
          aria-label="Create a new Hive"
        >
          <div className="w-12 h-12 rounded-full bg-[#1e2533]/30 flex items-center justify-center text-[#475569] group-hover:text-[#f5a623] mb-4 transition-colors">
            <Plus className="w-8 h-8" />
          </div>
          <p
            className="text-[#94a3b8] group-hover:text-[#f5a623] font-semibold text-base transition-colors"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
          >
            Initialize Hive
          </p>
          <p className="text-[#475569] text-[11px] text-center mt-1 tracking-wide uppercase" style={{ fontFamily: "JetBrains Mono, monospace" }}>
            Allocate new resources
          </p>
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteHiveDialog
        hive={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Skeleton card for loading state
// ---------------------------------------------------------------------------
function HiveCardSkeleton() {
  return (
    <div className="bg-[#0e1117] border border-[#1e2533] rounded-xl p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="w-12 h-12 rounded-lg animate-pulse bg-[#1e2533]" />
        <div className="w-20 h-6 rounded animate-pulse bg-[#1e2533]" />
      </div>
      <div className="w-3/4 h-5 rounded animate-pulse bg-[#1e2533] mb-2" />
      <div className="w-full h-4 rounded animate-pulse bg-[#1e2533] mb-1" />
      <div className="w-2/3 h-4 rounded animate-pulse bg-[#1e2533] mb-6" />
      <div className="flex justify-between">
        <div className="w-8 h-8 rounded-full animate-pulse bg-[#1e2533]" />
        <div className="w-20 h-4 rounded animate-pulse bg-[#1e2533]" />
      </div>
    </div>
  );
}
