"use client";

/**
 * components/ui/EmptyState.tsx — Reusable Empty State Component
 *
 * Purpose: Shown when a page/section has no data yet.
 * Accepts an icon, title, description, and optional CTA button.
 *
 * Usage:
 *   <EmptyState
 *     icon={<Kanban size={40} />}
 *     title="No tasks yet"
 *     description="Create your first task to start tracking work."
 *     action={{ label: "Create Task", onClick: () => setIsCreateOpen(true) }}
 *   />
 */

import React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-20 px-6 select-none",
        className
      )}
      role="status"
      aria-label={title}
    >
      {/* Icon container with subtle glow */}
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl scale-150" aria-hidden="true" />
        <div className="relative w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>

      {/* Title */}
      <h3
        className="text-base font-semibold text-foreground mb-1.5"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">
          {description}
        </p>
      )}

      {/* CTA Button */}
      {action && (
        <button
          onClick={action.onClick}
          className="
            inline-flex items-center gap-2 px-4 py-2
            rounded-lg bg-primary text-primary-foreground
            text-sm font-semibold
            hover:opacity-90 active:scale-95
            transition-all duration-150
            shadow-lg shadow-primary/20
          "
        >
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  );
}
