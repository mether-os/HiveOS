/**
 * app/(auth)/login/page.tsx — Landing / Authentication Page
 *
 * Purpose: The entry point of HiveOS. Faithfully implements Landing.html design:
 * - #080A0F void background
 * - Hex grid overlay at low opacity
 * - Amber (top-right) + blue (bottom-left) ambient glows
 * - "SYSTEM ONLINE" breathing indicator
 * - HiveOS wordmark (Space Grotesk 700)
 * - Tagline in secondary text
 * - GitHub + Google auth buttons
 * - "Join X teams building with HiveOS" footnote
 * - Vertical + horizontal decorative lines at container margins
 * - Mouse parallax effect on the center content
 *
 * This is a server component that renders static HTML.
 * The auth buttons are the only client component (AuthButtons.tsx).
 *
 * Interactions:
 * - Uses: features/auth/components/AuthButtons.tsx (client component)
 * - Protected by: middleware.ts (redirects to /dashboard if already logged in)
 */

import type { Metadata } from "next";
import { AuthButtons } from "@/features/auth/components/AuthButtons";
import { LandingParallax } from "@/features/auth/components/LandingParallax";

export const metadata: Metadata = {
  title: "HiveOS — The OS for Teams That Build",
  description:
    "Sign in to HiveOS. The AI-powered collaborative operating system for developer teams.",
};

export default function LoginPage() {
  return (
    <div className="relative min-h-screen bg-[#080a0f] overflow-hidden flex items-center justify-center">
      {/* ------------------------------------------------------------------ */}
      {/* Background Layer 1: Hex grid */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="hex-grid absolute inset-0 pointer-events-none z-[1]"
        aria-hidden="true"
      />

      {/* ------------------------------------------------------------------ */}
      {/* Background Layer 2: Ambient Glows */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="glow-amber-tr z-[2]"
        aria-hidden="true"
      />
      <div
        className="glow-blue-bl z-[2]"
        aria-hidden="true"
      />

      {/* ------------------------------------------------------------------ */}
      {/* Decorative Frame Lines — matches Landing.html's container-margin lines */}
      {/* ------------------------------------------------------------------ */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        {/* Left vertical */}
        <div className="absolute left-10 top-0 bottom-0 w-px bg-[#1e2533]/10" />
        {/* Right vertical */}
        <div className="absolute right-10 top-0 bottom-0 w-px bg-[#1e2533]/10" />
        {/* Top horizontal */}
        <div className="absolute top-10 left-0 right-0 h-px bg-[#1e2533]/10" />
        {/* Bottom horizontal */}
        <div className="absolute bottom-10 left-0 right-0 h-px bg-[#1e2533]/10" />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Main Content — parallax wrapper (client component) */}
      {/* ------------------------------------------------------------------ */}
      <LandingParallax>
        <main
          className="relative z-10 w-full max-w-[480px] px-4 text-center flex flex-col items-center"
          id="main-content"
        >
          {/* -------------------------------------------------------------- */}
          {/* System Online Indicator */}
          {/* -------------------------------------------------------------- */}
          <div
            className="mb-6 flex items-center justify-center gap-2"
            aria-label="System status: online"
          >
            <span
              className="w-2 h-2 rounded-full bg-[#f5a623] animate-breath"
              aria-hidden="true"
            />
            <span
              className="text-label-caps text-[#f5a623] tracking-[0.15em]"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              SYSTEM ONLINE
            </span>
          </div>

          {/* -------------------------------------------------------------- */}
          {/* HiveOS Identity */}
          {/* -------------------------------------------------------------- */}
          <div className="mb-8">
            <h1
              className="text-display text-[#f1f5f9] text-[48px] md:text-[56px] leading-none tracking-[-0.02em]"
              style={{ fontFamily: "Space Grotesk, sans-serif" }}
            >
              HiveOS
            </h1>
            <p
              className="text-[#94a3b8] text-base mt-2 leading-relaxed"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              The operating system for teams that build.
            </p>
          </div>

          {/* -------------------------------------------------------------- */}
          {/* Auth Buttons */}
          {/* -------------------------------------------------------------- */}
          <div className="w-full flex flex-col items-center mb-8">
            <AuthButtons />
          </div>

          {/* -------------------------------------------------------------- */}
          {/* Footer Footnote */}
          {/* -------------------------------------------------------------- */}
          <p
            className="text-[#475569]/80 text-xs"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            Join{" "}
            <span className="text-[#f5a623] font-bold">0</span>{" "}
            teams building with HiveOS
          </p>
        </main>
      </LandingParallax>
    </div>
  );
}
