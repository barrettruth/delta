import { and, eq } from "drizzle-orm";
import { accounts } from "@/db/schema";
import { refreshGoogleToken } from "./oauth";
import type { Db } from "./types";

export interface GoogleEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  recurrence?: string[];
  status?: string;
  updated?: string;
  conferenceData?: {
    entryPoints?: Array<{ uri?: string; entryPointType?: string }>;
  };
}

export interface GoogleEventList {
  items?: GoogleEvent[];
  nextSyncToken?: string;
  nextPageToken?: string;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
}

const BASE_URL = "https://www.googleapis.com/calendar/v3";

export async function getGoogleAccessToken(
  db: Db,
  userId: number,
): Promise<string> {
  const account = db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")))
    .get();

  if (!account) {
    throw new Error("No Google account linked");
  }

  if (!account.accessToken) {
    throw new Error("No access token available");
  }

  const now = new Date();
  const expiresAt = account.tokenExpiresAt
    ? new Date(account.tokenExpiresAt)
    : null;

  if (expiresAt && expiresAt <= now) {
    if (!account.refreshToken) {
      throw new Error("Token expired and no refresh token available");
    }

    const refreshed = await refreshGoogleToken(db, account.refreshToken);

    const newExpiresAt = new Date(
      Date.now() + refreshed.expiresIn * 1000,
    ).toISOString();

    db.update(accounts)
      .set({
        accessToken: refreshed.accessToken,
        tokenExpiresAt: newExpiresAt,
      })
      .where(eq(accounts.id, account.id))
      .run();

    return refreshed.accessToken;
  }

  return account.accessToken;
}

export async function listCalendarEvents(
  accessToken: string,
  calendarId: string,
  syncToken?: string,
): Promise<{ events: GoogleEvent[]; nextSyncToken?: string }> {
  const allEvents: GoogleEvent[] = [];
  let pageToken: string | undefined;
  let finalSyncToken: string | undefined;

  do {
    const params = new URLSearchParams();

    if (syncToken && !pageToken) {
      params.set("syncToken", syncToken);
    } else if (!syncToken) {
      params.set("singleEvents", "false");
      params.set("maxResults", "2500");
    }

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const res = await fetch(
      `${BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (res.status === 410) {
      return { events: [], nextSyncToken: undefined };
    }

    if (!res.ok) {
      throw new Error(`Google Calendar API error: ${res.status}`);
    }

    const data: GoogleEventList = await res.json();

    if (data.items) {
      allEvents.push(...data.items);
    }

    pageToken = data.nextPageToken ?? undefined;
    if (data.nextSyncToken) {
      finalSyncToken = data.nextSyncToken;
    }
  } while (pageToken);

  return { events: allEvents, nextSyncToken: finalSyncToken };
}

export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  event: Record<string, unknown>,
): Promise<GoogleEvent> {
  const res = await fetch(
    `${BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );

  if (!res.ok) {
    throw new Error(`Google Calendar create event failed: ${res.status}`);
  }

  return res.json();
}

export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: Record<string, unknown>,
): Promise<GoogleEvent> {
  const res = await fetch(
    `${BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    },
  );

  if (!res.ok) {
    throw new Error(`Google Calendar update event failed: ${res.status}`);
  }

  return res.json();
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar delete event failed: ${res.status}`);
  }
}

export async function createCalendar(
  accessToken: string,
  name: string,
): Promise<GoogleCalendar> {
  const res = await fetch(`${BASE_URL}/calendars`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ summary: name }),
  });

  if (!res.ok) {
    throw new Error(`Google Calendar create calendar failed: ${res.status}`);
  }

  return res.json();
}
