"use client";

/**
 * components/layout/TopBar.tsx — Global Navigation Bar
 *
 * Purpose: The fixed top bar present on all authenticated pages.
 * Clean typography, no monospace fonts on nav labels.
 */

import { useSession } from "@/features/auth/hooks/useSession";
import { signOut } from "@/lib/auth-client";
import { Notification, MessageQuestion, SearchNormal1 } from "iconsax-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function TopBar() {
  const { user, isAuthenticated } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const pathname = usePathname();

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/login"; } } });
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  const navLinks = [
    { label: "Hives", href: "/dashboard", exact: true },
    { label: "Network", href: "/dashboard/network", exact: false },
    { label: "Terminal", href: "/dashboard/terminal", exact: false },
  ];

  return (
    <nav
      className={cn(
        "fixed top-0 w-full z-50",
        "flex justify-between items-center",
        "px-5 h-16",
        "bg-[#060b13]/90 backdrop-blur-xl",
        "border-b border-[#131d30]"
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Left: Logo + Nav Links */}
      <div className="flex items-center gap-8">
        <Link
          href="/dashboard"
          className="text-[#f5a623] font-bold text-xl tracking-tight font-brand"
          aria-label="HiveOS — go to dashboard"
        >
          HiveOS
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = link.exact
              ? pathname === link.href
              : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors duration-150",
                  isActive
                    ? "text-[#f5a623] bg-[#f5a623]/8"
                    : "text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#111a2e]/50"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Right: Search + Actions + Avatar */}
      <div className="flex items-center gap-2">
        {/* Search — desktop only */}
        <div className="hidden sm:flex items-center gap-2 bg-[#111a2e] border border-[#131d30] rounded-lg px-3 py-1.5">
          <SearchNormal1 size="16" className="text-[#64748b]" aria-hidden="true" />
          <input
            type="text"
            placeholder="Jump to..."
            className="bg-transparent border-none outline-none text-[13px] text-[#f0f4f8] placeholder:text-[#64748b] w-36"
            aria-label="Quick jump search"
          />
        </div>

        {/* Notification Bell */}
        <button
          className="p-2 text-[#94a3b8] hover:text-[#f0f4f8] transition-colors rounded-lg hover:bg-[#111a2e]/50 active:scale-95"
          aria-label="Notifications"
          title="Notifications"
        >
          <Notification size="18" />
        </button>

        {/* Help */}
        <button
          className="p-2 text-[#94a3b8] hover:text-[#f0f4f8] transition-colors rounded-lg hover:bg-[#111a2e]/50 active:scale-95"
          aria-label="Help"
          title="Help"
        >
          <MessageQuestion size="18" />
        </button>

        {/* User Avatar */}
        {isAuthenticated && (
          <button
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="relative w-8 h-8 rounded-full border border-[#f5a623]/30 overflow-visible active:scale-95 transition-transform ml-1"
            title={signingOut ? "Signing out..." : `${user?.name ?? "User"} — click to sign out`}
            aria-label={`${user?.name ?? "User"} — click to sign out`}
          >
            <div className="w-8 h-8 rounded-full overflow-hidden">
              {user?.image ? (
                <Image
                  src={user.image}
                  alt={user.name ?? "User avatar"}
                  width={32}
                  height={32}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full bg-[#111a2e] flex items-center justify-center text-[#f5a623] text-xs font-bold">
                  {initials}
                </div>
              )}
            </div>
            <span
              className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#f5a623] rounded-full border-2 border-[#020408] animate-pulse"
              aria-hidden="true"
            />
          </button>
        )}
      </div>
    </nav>
  );
}
