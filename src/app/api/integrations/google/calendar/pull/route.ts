import { NextResponse } from "next/server";
import { GoogleCalendarApiError } from "@/core/google/calendar-client";
import { pullGoogleCalendar } from "@/core/google/calendar-pull";
import { GoogleAuthError } from "@/core/google/oauth";
import { db } from "@/db";
import { unauthorized } from "@/lib/auth-responses";
import { getApiKeyUserOrLocalOwnerFromRequest } from "@/lib/request-auth";

function errorResponse(error: unknown): NextResponse {
  if (error instanceof GoogleAuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }
  if (error instanceof GoogleCalendarApiError) {
    const status = error.status === 429 ? 429 : 502;
    return NextResponse.json({ error: error.message }, { status });
  }
  const message =
    error instanceof Error ? error.message : "Google Calendar pull failed";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function POST(request: Request) {
  const user = await getApiKeyUserOrLocalOwnerFromRequest(request);
  if (!user) return unauthorized();

  try {
    const result = await pullGoogleCalendar(db, user.id);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
