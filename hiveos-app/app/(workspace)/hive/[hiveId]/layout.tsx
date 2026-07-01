/**
 * app/(workspace)/hive/[hiveId]/layout.tsx — Workspace Layout
 *
 * Purpose: Three-panel workspace shell for all Hive workspace pages.
 * Implements the workspace.html three-panel layout:
 *
 * ┌──────────────────────────────────────────────────────┐
 * │ Top Bar (64px)                                       │
 * ├──────┬────────────────────────────────┬──────────────┤
 * │ Left │    Main Content Area           │ Right Panel  │
 * │Sidebar│   (Canvas/Tasks/Docs/etc.)   │ (AI / Chat)  │
 * │(64px)│                               │   (320px)    │
 * └──────┴────────────────────────────────┴──────────────┘
 *
 * Left sidebar: 64px icon-only (Canvas, Tasks, Docs, Activity, Intelligence)
 * Right panel: 320px HiveMind AI panel (placeholder for Phase 2)
 *
 * Interactions:
 * - Used by: ALL workspace tab pages
 * - Imports: components/layout/WorkspaceTopBar.tsx
 *           components/layout/WorkspaceLeftSidebar.tsx
 *           components/layout/WorkspaceRightPanel.tsx
 */

import { WorkspaceTopBar } from "@/components/layout/WorkspaceTopBar";
import { WorkspaceLeftSidebar } from "@/components/layout/WorkspaceLeftSidebar";
import { WorkspaceRightPanel } from "@/components/layout/WorkspaceRightPanel";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { RealtimeWorkspaceController } from "@/features/realtime/components/RealtimeWorkspaceController";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ hiveId: string }>;
}

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { hiveId } = await params;

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Global Command Palette search overlay */}
      <CommandPalette hiveId={hiveId} />

      {/* Realtime channel presence controller */}
      <RealtimeWorkspaceController hiveId={hiveId} />

      {/* Fixed top bar with tab navigation */}
      <WorkspaceTopBar hiveId={hiveId} />

      <main className="flex h-screen pt-16 pl-16 md:pr-80">
        {/* Left icon-only sidebar (64px) */}
        <WorkspaceLeftSidebar hiveId={hiveId} />

        {/* Main content area — between sidebars */}
        <section
          className="flex-1 relative overflow-hidden bg-background"
          aria-label="Main workspace content"
        >
          {/* Dot grid background */}
          <div
            className="absolute inset-0 dot-grid opacity-20 pointer-events-none"
            aria-hidden="true"
          />
          {/* Page content */}
          <div className="relative z-10 h-full">
            {children}
          </div>
        </section>

        {/* Right AI panel (320px) — placeholder */}
        <WorkspaceRightPanel hiveId={hiveId} />
      </main>
    </div>
  );
}
