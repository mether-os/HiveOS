import { NextRequest, NextResponse } from "next/server";

// No runtime export — runs on Edge, no Node imports needed

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/hive",
  "/onboarding",
  "/network",
  "/terminal",
];

const AUTH_ROUTES = ["/login", "/"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route);

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    (!isProtected && !isAuthRoute)
  ) {
    return NextResponse.next();
  }

  const sessionCookie =
    request.cookies.get("better-auth.session_token") ||
    request.cookies.get("__Secure-better-auth.session_token");

  const isAuthenticated = !!sessionCookie?.value;

  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};