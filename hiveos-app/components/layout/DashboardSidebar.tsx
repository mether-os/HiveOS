"use client";

/**
 * components/layout/DashboardSidebar.tsx — Left Sidebar (Dashboard)
 *
 * Purpose: The fixed left sidebar for dashboard pages.
 * Clean, modern design with proper sans-serif typography.
 */

import {
  Category,
  DocumentText,
  Kanban,
  Setting2,
  MessageQuestion,
  User,
} from "iconsax-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  icon: any;
  label: string;
  href: string;
  disabled?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Category, label: "Canvas", href: "/dashboard/canvas" },
  { icon: Kanban, label: "Tasks", href: "/dashboard/tasks" },
  { icon: DocumentText, label: "Docs", href: "/dashboard/docs" },
  { icon: Category, label: "Hives", href: "/dashboard" },
  { icon: Setting2, label: "Settings", href: "/dashboard/settings" },
];

const BOTTOM_ITEMS: NavItem[] = [
  { icon: MessageQuestion, label: "Support", href: "/dashboard/support" },
  { icon: User, label: "Profile", href: "/dashboard/profile" },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-16 z-40",
        "w-64 h-[calc(100vh-4rem)]",
        "bg-[#060b13] border-r border-[#131d30]",
        "flex-col py-5",
        "hidden md:flex"
      )}
      aria-label="Dashboard sidebar"
    >
      {/* Header */}
      <div className="px-5 mb-8 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[#f5a623]/10 border border-[#f5a623]/20 flex items-center justify-center">
          <Category size="18" variant="Bold" className="text-[#f5a623]" />
        </div>
        <div>
          <h2 className="text-[#f5a623] font-semibold text-sm leading-tight font-brand">
            My Workspace
          </h2>
          <p className="text-[#64748b] text-[11px]">
            Your Hives
          </p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <NavLink key={item.label} item={item} isActive={isActive} Icon={Icon} />
          );
        })}
      </nav>

      {/* Bottom Links */}
      <div className="mt-auto border-t border-[#131d30] pt-3 px-3">
        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.label} item={item} isActive={false} Icon={Icon} />
          );
        })}
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */

interface NavLinkProps {
  item: NavItem;
  isActive: boolean;
  Icon: any;
}

function NavLink({ item, isActive, Icon }: NavLinkProps) {
  const base = cn(
    "flex items-center gap-3 px-3 py-2.5 rounded-lg",
    "text-[13px] font-medium",
    "transition-colors duration-150 cursor-pointer",
    "active:scale-[0.98]"
  );

  const content = (
    <>
      <Icon
        size="18"
        variant={isActive ? "Bold" : "Linear"}
        className="flex-shrink-0"
      />
      <span>{item.label}</span>
    </>
  );

  if (item.disabled) {
    return (
      <span
        className={cn(base, "text-[#475569] opacity-60 cursor-not-allowed")}
        title="Coming soon"
      >
        {content}
      </span>
    );
  }

  if (isActive) {
    return (
      <span
        className={cn(
          base,
          "bg-[#6366f1]/10 text-[#f0f4f8]",
          "border-l-2 border-[#6366f1] rounded-l-none"
        )}
        aria-current="page"
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        base,
        "text-[#94a3b8] hover:bg-[#111a2e]/60 hover:text-[#f0f4f8]"
      )}
    >
      {content}
    </Link>
  );
}
