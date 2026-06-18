"use client";

/**
 * features/auth/components/AuthButtons.tsx — OAuth Login Buttons
 *
 * Purpose: GitHub and Google OAuth login buttons. Handles the sign-in flow
 *          and loading states. Extracted from the login page for reusability.
 *
 * Why "use client"? signIn.social() calls the Better Auth client which
 * uses React hooks internally. Must be a client component.
 *
 * States:
 * - idle: shows provider icon + text
 * - loading: shows animated spinner, button disabled, can't click again
 * - error: shows error message below buttons
 *
 * Interactions:
 * - Uses: lib/auth-client.ts (signIn.social)
 * - Used by: app/(auth)/login/page.tsx
 */

import { signIn } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";
import { useState } from "react";

type Provider = "github" | "google";

interface SignInState {
  loading: Provider | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// SVG Icons — inline to avoid external dependencies
// ---------------------------------------------------------------------------

function GitHubIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.041-1.416-4.041-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Auth Button — shared button structure for each provider
// ---------------------------------------------------------------------------

interface AuthButtonProps {
  provider: Provider;
  label: string;
  icon: React.ReactNode;
  isLoading: boolean;
  disabled: boolean;
  onClick: () => void;
}

function AuthButton({
  label,
  icon,
  isLoading,
  disabled,
  onClick,
}: AuthButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="
        relative w-full max-w-[360px] h-12
        flex items-center justify-center gap-3
        bg-[#141920] border border-[#1E2533]
        rounded-lg
        text-[#F1F5F9] text-sm font-medium
        transition-all duration-200
        hover:border-[#f5a623]/40 hover:shadow-[0_0_15px_rgba(245,166,35,0.1)]
        active:scale-[0.98]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5a623] focus-visible:ring-offset-2 focus-visible:ring-offset-[#080a0f]
      "
      type="button"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-[#f5a623]" aria-hidden="true" />
          <span>Authorizing...</span>
        </>
      ) : (
        <>
          {icon}
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main AuthButtons component
// ---------------------------------------------------------------------------

export function AuthButtons() {
  const [state, setState] = useState<SignInState>({
    loading: null,
    error: null,
  });

  async function handleSignIn(provider: Provider) {
    if (state.loading) return; // Prevent double-click

    setState({ loading: provider, error: null });

    try {
      await signIn.social({
        provider,
        callbackURL: "/dashboard",
      });
      // Better Auth handles the redirect — this code won't execute
    } catch (err) {
      console.error(`[AuthButtons] ${provider} sign-in error:`, err);
      setState({
        loading: null,
        error: `Failed to sign in with ${provider === "github" ? "GitHub" : "Google"}. Please try again.`,
      });
    }
  }

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <AuthButton
        provider="github"
        label="Continue with GitHub"
        icon={<GitHubIcon />}
        isLoading={state.loading === "github"}
        disabled={state.loading !== null}
        onClick={() => void handleSignIn("github")}
      />

      <AuthButton
        provider="google"
        label="Continue with Google"
        icon={<GoogleIcon />}
        isLoading={state.loading === "google"}
        disabled={state.loading !== null}
        onClick={() => void handleSignIn("google")}
      />

      {/* Error message */}
      {state.error && (
        <p
          className="text-xs text-red-400 text-center mt-1 animate-fade-up"
          role="alert"
        >
          {state.error}
        </p>
      )}
    </div>
  );
}
