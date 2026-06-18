import type { NextConfig } from "next";

/**
 * HiveOS — Next.js Configuration
 *
 * Purpose: Centralized Next.js config with security headers and image domains.
 * Why needed: Production-ready defaults that Next.js doesn't ship with.
 * Interactions: Read by Next.js build pipeline. Affects all page rendering,
 *               API routes, and static asset handling.
 */

const nextConfig: NextConfig = {
  // ---------------------------------------------------------------------------
  // Strict mode for React 19 — catches double-render bugs in dev
  // ---------------------------------------------------------------------------
  reactStrictMode: true,
  output: "standalone",

  // ---------------------------------------------------------------------------
  // Image optimization — allowed external domains for next/image
  // ---------------------------------------------------------------------------
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/**",
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Security headers — applied to every response
  // ---------------------------------------------------------------------------
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrer policy — don't leak URLs to third parties
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Permissions policy — disable unnecessary browser features
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Content Security Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://lh3.googleusercontent.com https://avatars.githubusercontent.com",
              "connect-src 'self' ws://localhost:3002 wss://localhost:3002 http://localhost:3002 https://api.anthropic.com",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },

  // ---------------------------------------------------------------------------
  // Performance: Let Next.js use all available CPU cores (default behavior).
  // Previously set to cpus: 1 which caused severe lag during development.
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Performance: Limit build workers to 2 to prevent OOM on dev laptops.
  // Unlimited workers crash Windows with STATUS_STACK_BUFFER_OVERRUN (0xC0000409)
  // when each worker spawns MongoDB + Redis connections simultaneously.
  // ---------------------------------------------------------------------------
  experimental: {
    workerThreads: false,
    cpus: 2,
  },

  // ---------------------------------------------------------------------------
  // Skip ESLint during builds — run linting separately with npm run lint.
  // Warnings (unused vars, img tags) don't block features but slow down builds.
  // ---------------------------------------------------------------------------
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;