"use client";

/**
 * features/auth/components/LandingParallax.tsx — Mouse Parallax Effect
 *
 * Purpose: Wraps the landing page center content to implement the subtle
 *          mouse-move parallax effect from Landing.html.
 *
 * Effect: As the mouse moves, the center content shifts slightly opposite
 *         to the cursor direction — giving a floating, dimensional feel.
 *
 * Why extracted? The login page is a server component for SEO/performance.
 * The parallax requires mouse event listeners (client-only). Extracting to
 * a client component keeps the page server-rendered while adding the effect.
 *
 * The same parallax factor as Landing.html: divide by 50.
 *
 * Interactions:
 * - Used by: app/(auth)/login/page.tsx
 */

import { type ReactNode, useCallback, useRef } from "react";

interface LandingParallaxProps {
  children: ReactNode;
}

export function LandingParallax({ children }: LandingParallaxProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const x = (window.innerWidth / 2 - e.pageX) / 50;
    const y = (window.innerHeight / 2 - e.pageY) / 50;

    containerRef.current.style.transform = `translateX(${x}px) translateY(${y}px)`;
    containerRef.current.style.transition = "transform 0.1s ease-out";
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.style.transform = "translateX(0) translateY(0)";
    containerRef.current.style.transition = "transform 0.5s ease-out";
  }, []);

  return (
    <div
      className="w-full flex items-center justify-center"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div ref={containerRef} className="will-change-transform">
        {children}
      </div>
    </div>
  );
}
