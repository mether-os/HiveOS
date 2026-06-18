"use client";

import React from "react";
import { usePresenceStore } from "../hooks/usePresence";
import { cn } from "@/lib/utils";

interface PresenceIndicatorProps {
  userId: string;
  className?: string;
  showText?: boolean;
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  userId,
  className,
  showText = false,
}) => {
  const workspaceMembers = usePresenceStore((state) => state.workspaceMembers);
  const isOnline = workspaceMembers?.some?.((m) => m.id === userId) ?? false;

  return (
    <div className={cn("flex items-center gap-2 select-none", className)}>
      <span className="relative flex h-2 w-2">
        {isOnline && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        )}
        <span
          className={cn(
            "relative inline-flex rounded-full h-2 w-2 transition-colors duration-300",
            isOnline ? "bg-emerald-500" : "bg-neutral-500"
          )}
        ></span>
      </span>
      {showText && (
        <span className={cn("text-[10px] font-semibold tracking-wide uppercase transition-colors duration-300", isOnline ? "text-emerald-400/90" : "text-neutral-500")}>
          {isOnline ? "Active" : "Offline"}
        </span>
      )}
    </div>
  );
};
