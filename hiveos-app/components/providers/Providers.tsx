"use client";

/**
 * components/providers/Providers.tsx — Client-side Provider Tree
 *
 * Purpose: Wraps the entire application in all required React context providers.
 * Centralizing providers here keeps the root layout clean.
 *
 * Why "use client"? React Query's QueryClientProvider and the auth session
 * hook are client-side. The root layout.tsx is a server component, so we
 * move the client boundary here.
 *
 * Provider order matters:
 * 1. QueryClientProvider — innermost providers can use useQuery
 * 2. ReactQueryDevtools — only rendered in development
 *
 * Future additions to this tree:
 * - Zustand store initialization (if global hydration needed)
 * - Toast provider (for notifications)
 * - Socket.io context (Phase 2)
 *
 * Interactions:
 * - Imported by: app/layout.tsx (wraps entire page tree)
 * - Provides context to: ALL client components in the app
 */

import { getQueryClient } from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { type ReactNode } from "react";
import { useEffect } from "react";
import { RealtimeProvider } from "@/features/realtime/hooks/useSocket";
import { Toaster } from "sonner";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  // getQueryClient() returns the browser singleton or creates a new server client
  const queryClient = getQueryClient();

  // Suppress MetaMask and other extension errors that leak into global error handler
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      const msg = event.message || "";
      const src = event.filename || "";
      // Ignore MetaMask inpage script errors and other known extension noise
      if (msg.includes("MetaMask") || src.includes("inpage.js") || src.includes("extension")) {
        event.preventDefault();
        console.debug("[Providers] Suppressed extension error:", msg);
      }
    };

    window.addEventListener("error", handler);
    window.addEventListener("unhandledrejection", (e) => {
      const reason = e.reason?.message || String(e.reason);
      if (reason.includes("MetaMask") || reason.includes("inpage")) {
        e.preventDefault();
        console.debug("[Providers] Suppressed extension promise rejection:", reason);
      }
    });

    return () => {
      window.removeEventListener("error", handler);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        {children}
      </RealtimeProvider>
      {/* Global toast notifications — styled to match HiveOS dark theme */}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#0e1117",
            border: "1px solid #1e2533",
            color: "#f1f5f9",
            fontFamily: "var(--font-sans)",
            fontSize: "13px",
          },
        }}
      />
      {/* DevTools only appear in development, zero-cost in production */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
