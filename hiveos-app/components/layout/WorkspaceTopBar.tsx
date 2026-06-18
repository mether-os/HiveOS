"use client";

/**
 * components/layout/WorkspaceTopBar.tsx — Workspace Navigation Bar
 *
 * Purpose: Top bar for the Hive workspace. Different from DashboardTopBar —
 * includes Hive name + workspace switcher, tab navigation, and member presence.
 * Faithfully implements the workspace.html top bar.
 *
 * Left: HiveOS logo | Hive name (with chevron)
 * Center: Canvas | Tasks | Docs | Activity | Intelligence tabs
 * Right: Member presence avatars + action buttons + user avatar
 *
 * Interactions:
 * - Uses: features/hives/hooks/useHives.ts (useHive for name)
 * - Used by: app/(workspace)/hive/[hiveId]/layout.tsx
 */

import { useHive } from "@/features/hives/hooks/useHives";
import { useSession } from "@/features/auth/hooks/useSession";
import { cn } from "@/lib/utils";
import {
  Notification,
  ArrowDown2,
  SearchNormal1,
} from "iconsax-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { usePresenceStore } from "@/features/realtime/hooks/usePresence";
import { PresenceAvatar } from "@/features/realtime/components/PresenceAvatar";

interface WorkspaceTopBarProps {
  hiveId: string;
}

const WORKSPACE_TABS = [
  { label: "Canvas", path: "canvas" },
  { label: "Tasks", path: "tasks" },
  { label: "Docs", path: "documents" },
  { label: "Activity", path: "activity" },
  { label: "Intelligence", path: "intelligence" },
] as const;

export function WorkspaceTopBar({ hiveId }: WorkspaceTopBarProps) {
  const pathname = usePathname();
  const { data: hive } = useHive(hiveId);
  const { user } = useSession();
  const workspaceMembers = usePresenceStore((state) => state.workspaceMembers);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  return (
    <header
      className="
        fixed top-0 w-full z-50
        flex justify-between items-center
        px-4 h-16
        bg-surface/80 backdrop-blur-xl
        border-b border-border
      "
      role="banner"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Left: Logo + Hive Name */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-6">
        {/* HiveOS logo + hive name switcher */}
        <Link
          href="/dashboard"
          className="flex items-center gap-3 group"
          aria-label="HiveOS — go to dashboard"
        >
          <span
            className="text-primary font-bold text-xl tracking-tighter"
            style={{ fontFamily: "Space Grotesk, sans-serif" }}
          >
            HiveOS
          </span>
          <div className="h-4 w-px bg-border" aria-hidden="true" />
          <div className="flex items-center gap-1">
            <span className="text-foreground font-semibold text-sm truncate max-w-[160px]">
              {hive?.name ?? "Loading..."}
            </span>
            <ArrowDown2 size="16" className="text-muted-foreground" />
          </div>
        </Link>

        {/* Tab Navigation — desktop only */}
        <nav
          className="hidden md:flex items-center gap-1"
          aria-label="Workspace sections"
        >
          {WORKSPACE_TABS.map((tab) => {
            const href = `/hive/${hiveId}/${tab.path}`;
            const isActive = pathname === href || pathname.startsWith(href + "/");

            return (
              <Link
                key={tab.path}
                href={href}
                className={cn(
                  "px-3 py-1 rounded-md text-sm font-medium transition-colors duration-150",
                  isActive
                    ? "text-primary border-b-2 border-primary rounded-none pb-0"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Right: Actions + Avatar */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center gap-2">
        {/* Presence avatars stack */}
        <div className="flex -space-x-2 mr-3 items-center" aria-label="Active members">
          {workspaceMembers.map((member) => (
            <PresenceAvatar
              key={member.id}
              userId={member.id}
              name={member.name}
              image={member.image}
              size="sm"
              className="border-2 border-background"
            />
          ))}
        </div>

        {/* Search */}
        <button
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary/50 active:scale-95"
          aria-label="Search"
        >
          <SearchNormal1 size="20" />
        </button>

        {/* Notifications */}
        <button
          className="relative p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary/50 active:scale-95"
          aria-label="Notifications"
        >
          <Notification size="20" />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full"
            aria-hidden="true"
          />
        </button>

        {/* User avatar */}
        <div className="w-9 h-9 rounded-lg border border-border overflow-hidden">
          {user?.image ? (
            <Image
              src={user.image}
              alt={user.name ?? "User"}
              width={36}
              height={36}
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center text-primary text-xs font-bold">
              {initials}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
