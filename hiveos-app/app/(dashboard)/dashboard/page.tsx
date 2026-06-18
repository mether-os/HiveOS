// Server Component — do NOT add "use client" here (metadata export requires server context)

/**
 * app/(dashboard)/dashboard/page.tsx — Dashboard Page
 *
 * Purpose: The main page users see after logging in.
 * Faithfully implements dashboard.html design.
 *
 * Layout:
 * - Section header: "Your Hives" + "New Hive" button
 * - 2-column HiveGrid (cards + add card)
 * - "Active Cognition" bento section at bottom (placeholder for Phase 2)
 *
 * This is a client component because:
 * - "New Hive" button needs state (modal open/close)
 * - HiveGrid uses React Query which is client-side
 *
 * Interactions:
 * - Uses: features/hives/components/HiveGrid.tsx
 * - Uses: features/hives/components/CreateHiveModal.tsx
 * - Uses: features/auth/hooks/useSession.ts (user greeting)
 * - Protected by: middleware.ts
 */

import type { Metadata } from "next";
import { DashboardClient } from "./DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "View and manage your HiveOS workspaces.",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
