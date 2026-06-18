/**
 * app/(auth)/login/layout.tsx — Auth Route Group Layout
 *
 * Purpose: Layout for the (auth) route group. Provides a fullscreen,
 *          centered shell for the login page. No navigation, no sidebar.
 *
 * Why a separate layout? The root layout wraps everything. The auth layout
 * provides the minimal fullscreen shell appropriate for a login/landing page.
 * Dashboard and workspace pages use their own layouts with navigation.
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
