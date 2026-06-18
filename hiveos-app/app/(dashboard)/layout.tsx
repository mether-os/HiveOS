/**
 * app/(dashboard)/layout.tsx — Dashboard Route Group Layout
 *
 * Purpose: Provides the app shell (top nav + left sidebar) for all
 *          dashboard pages. The (workspace) group has its own layout.
 *
 * This is a server component. The TopBar and Sidebar components are
 * client components nested inside — they handle interactivity.
 */

import { TopBar } from "@/components/layout/TopBar";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Fixed top navigation bar */}
      <TopBar />

      {/* Fixed left sidebar — hidden on mobile */}
      <DashboardSidebar />

      {/* Main content — offset for top bar (64px) and sidebar (256px) */}
      <main className="pt-16 md:ml-64 min-h-screen bg-background">
        {children}
      </main>
    </div>
  );
}
