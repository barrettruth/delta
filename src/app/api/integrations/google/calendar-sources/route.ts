import { NextResponse } from "next/server";
import {
  GoogleCalendarApiError,
  listGoogleCalendars,
} from "@/core/google/calendar-client";
import {
  listGoogleCalendarSources,
  syncGoogleCalendarSources,
} from "@/core/google/calendar-sources";
import { GoogleAuthError, getGoogleAccessToken } from "@/core/google/oauth";
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
    error instanceof Error ? error.message : "Google Calendar discovery failed";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: Request) {
  const user = await getApiKeyUserOrLocalOwnerFromRequest(request);
  if (!user) return unauthorized();

  return NextResponse.json({
    sources: listGoogleCalendarSources(db, user.id),
  });
}

export async function POST(request: Request) {
  const user = await getApiKeyUserOrLocalOwnerFromRequest(request);
  if (!user) return unauthorized();

  try {
    const accessToken = await getGoogleAccessToken(db, user.id);
    const calendars = await listGoogleCalendars(accessToken);
    return NextResponse.json({
      sources: syncGoogleCalendarSources(db, user.id, calendars),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
