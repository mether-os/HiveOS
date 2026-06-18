"use client";

import React from "react";
import { usePresenceStore } from "../hooks/usePresence";
import { cn } from "@/lib/utils";

interface PresenceAvatarProps {
  userId: string;
  name: string;
  image?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const PresenceAvatar: React.FC<PresenceAvatarProps> = ({
  userId,
  name,
  image,
  size = "md",
  className,
}) => {
  const workspaceMembers = usePresenceStore((state) => state.workspaceMembers);
  const isOnline = workspaceMembers?.some?.((m) => m.id === userId) ?? false;

  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };

  const dotSizeClasses = {
    sm: "h-2.5 w-2.5 -right-0.5 -bottom-0.5 border-2",
    md: "h-3 w-3 right-0 bottom-0 border-2",
    lg: "h-3.5 w-3.5 right-0.5 bottom-0.5 border-2",
  };

  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <div className={cn("relative inline-block select-none", className)}>
      {image ? (
        <img
          src={image}
          alt={name}
          className={cn("rounded-full object-cover border border-neutral-800", sizeClasses[size])}
        />
      ) : (
        <div
          className={cn(
            "rounded-full flex items-center justify-center font-medium bg-neutral-800 border border-neutral-700 text-neutral-300",
            sizeClasses[size]
          )}
        >
          {initials}
        </div>
      )}
      
      {/* Presence Dot with glowing animation if online */}
      <span
        className={cn(
          "absolute rounded-full border-neutral-950 flex items-center justify-center",
          dotSizeClasses[size],
          isOnline ? "bg-emerald-500" : "bg-neutral-500"
        )}
      >
        {isOnline && (
          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75"></span>
        )}
      </span>
    </div>
  );
};
