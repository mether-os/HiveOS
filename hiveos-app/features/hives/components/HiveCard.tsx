"use client";

/**
 * features/hives/components/HiveCard.tsx — Individual Hive Card
 *
 * Purpose: Renders one Hive workspace card in the dashboard grid.
 * Faithfully implements the card design from dashboard.html:
 * - Dark #0E1117 background, #1E2533 border
 * - Hover: amber glow border + box-shadow + translateY(-2px)
 * - Top row: Icon + status badge
 * - Hive name (Space Grotesk)
 * - Description text
 * - Bottom row: placeholder avatars + Last Sync time
 * - Delete button (appears on hover)
 *
 * On click → navigates to /hive/:id/canvas (workspace)
 *
 * Interactions:
 * - Used by: features/hives/components/HiveGrid.tsx
 * - Calls: features/hives/hooks/useHives.ts (useDeleteHive via DeleteDialog)
 */

import type { Hive } from "@/features/hives/types";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Grid3X3, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface HiveCardProps {
  hive: Hive;
  onDelete: (hive: Hive) => void;
}

export function HiveCard({ hive, onDelete }: HiveCardProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);

  const timeAgo = formatDistanceToNow(new Date(hive.createdAt), {
    addSuffix: true,
  });

  function handleCardClick(e: React.MouseEvent) {
    // Don't navigate if clicking the delete button
    const target = e.target as HTMLElement;
    if (target.closest("[data-delete-btn]")) return;
    router.push(`/hive/${hive.id}/canvas`);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleCardClick(e as unknown as React.MouseEvent);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "relative group cursor-pointer p-6 rounded-xl",
        "bg-[#0e1117] border border-[#1e2533]",
        "hover:border-[#f5a623]/40 hover:shadow-lg hover:shadow-[#f5a623]/5 hover:-translate-y-0.5",
        "transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5a623] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080a0f]"
      )}
      aria-label={`Open ${hive.name} workspace`}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Top Row: Icon + Status + Delete */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex justify-between items-start mb-4">
        {/* Workspace icon */}
        <div className="w-12 h-12 rounded-lg bg-[#1a1f2c] border border-[#1e2533] flex items-center justify-center text-[#f5a623]">
          <Grid3X3 className="w-6 h-6" />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <span
            className="
              px-2 py-1
              text-[10px] font-bold tracking-[0.08em] uppercase rounded
              bg-[#f5a623] text-[#1a0e00]
            "
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            Active
          </span>

          {/* Delete button — visible on hover */}
          <button
            data-delete-btn
            onClick={(e) => {
              e.stopPropagation();
              onDelete(hive);
            }}
            className={cn(
              "p-1.5 rounded-lg transition-all duration-200",
              "text-[#475569] hover:text-[#ef4444] hover:bg-[#ef4444]/10",
              isHovered ? "opacity-100" : "opacity-0"
            )}
            aria-label={`Delete ${hive.name}`}
            title={`Delete ${hive.name}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Hive Name + Description */}
      {/* ------------------------------------------------------------------ */}
      <h3
        className="text-[#f5a623] font-semibold text-lg mb-1 leading-tight"
        style={{ fontFamily: "Space Grotesk, sans-serif" }}
      >
        {hive.name}
      </h3>

      <p className="text-[#94a3b8] text-sm mb-6 leading-relaxed line-clamp-2">
        {hive.description ?? "No description yet."}
      </p>

      {/* ------------------------------------------------------------------ */}
      {/* Bottom Row: Avatars + Last Sync */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between mt-auto">
        {/* Placeholder member avatar stack */}
        <div className="flex -space-x-2">
          <div className="w-7 h-7 rounded-full bg-[#1a1f2c] border-2 border-[#0e1117] flex items-center justify-center text-[9px] font-bold text-[#94a3b8]">
            ME
          </div>
        </div>

        {/* Last Sync / Created time */}
        <div className="text-right">
          <p
            className="text-[10px] text-[#475569] uppercase tracking-wide mb-0.5"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            Created
          </p>
          <p
            className="text-[13px] text-[#94a3b8]"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            {timeAgo}
          </p>
        </div>
      </div>
    </div>
  );
}
