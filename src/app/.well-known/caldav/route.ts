import { NextResponse } from "next/server";

export function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/api/calendar/feed/", url.origin), 301);
}
