import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function addSecurityHeaders(response: NextResponse, request: NextRequest) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  const isProduction =
    process.env.NODE_ENV === "production" ||
    request.nextUrl.hostname !== "localhost";
  if (isProduction) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains",
    );
  }

  return response;
}

export function middleware(request: NextRequest) {
  const session = request.cookies.get("session");
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return addSecurityHeaders(NextResponse.next(), request);
  }

  if (!session && pathname !== "/login") {
    return addSecurityHeaders(
      NextResponse.redirect(new URL("/login", request.url)),
      request,
    );
  }

  if (session && pathname === "/login") {
    return addSecurityHeaders(
      NextResponse.redirect(new URL("/", request.url)),
      request,
    );
  }

  return addSecurityHeaders(NextResponse.next(), request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
