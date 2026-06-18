/**
 * app/layout.tsx — Root Layout (Server Component)
 *
 * Purpose: The outermost shell wrapping every page in the app.
 * Defines global HTML structure, metadata, fonts, and client providers.
 *
 * Font loading uses next/font/google — the recommended Next.js 15 approach.
 * Benefits: fonts are self-hosted (no external network request), zero layout
 * shift (CLS = 0), and no render-blocking.
 *
 * Interactions:
 * - Wraps: ALL pages in the app (landing, dashboard, workspace)
 * - Imports: components/providers/Providers.tsx (client boundary)
 * - Sets: global metadata, viewport, font preloads
 */

import type { Metadata, Viewport } from "next";
import { Outfit, Plus_Jakarta_Sans, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import "@/app/globals.css";

// ---------------------------------------------------------------------------
// Fonts — self-hosted via next/font/google (zero layout shift, no blocking)
// ---------------------------------------------------------------------------
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-brand",
  display: "swap",
});

// ---------------------------------------------------------------------------
// SEO Metadata — applied to all pages unless overridden in page.tsx
// ---------------------------------------------------------------------------
export const metadata: Metadata = {
  title: {
    default: "HiveOS — The OS for Teams That Build",
    template: "%s | HiveOS",
  },
  description:
    "HiveOS is an AI-powered collaborative operating system for developer teams. " +
    "Canvas, tasks, documents, and AI — unified in one workspace.",
  keywords: [
    "collaboration",
    "developer tools",
    "AI workspace",
    "project management",
    "team OS",
  ],
  authors: [{ name: "HiveOS" }],
  creator: "HiveOS",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "HiveOS",
    title: "HiveOS — The OS for Teams That Build",
    description:
      "AI-powered collaborative OS for developer teams. One workspace for everything.",
  },
  twitter: {
    card: "summary_large_image",
    title: "HiveOS",
    description: "The OS for teams that build.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

// ---------------------------------------------------------------------------
// Viewport configuration
// ---------------------------------------------------------------------------
export const viewport: Viewport = {
  themeColor: "#080a0f",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

// ---------------------------------------------------------------------------
// Root Layout Component
// ---------------------------------------------------------------------------
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${outfit.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
