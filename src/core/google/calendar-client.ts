import type { GoogleCalendarListEntry } from "./types";

const CALENDAR_LIST_URL =
  "https://www.googleapis.com/calendar/v3/users/me/calendarList";

interface GoogleCalendarListResponse {
  items?: GoogleCalendarListEntry[];
  nextPageToken?: string;
}

export class GoogleCalendarApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "GoogleCalendarApiError";
  }
}

async function googleGet<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new GoogleCalendarApiError(
      `Google Calendar request failed (${response.status})`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

export async function listGoogleCalendars(
  accessToken: string,
): Promise<GoogleCalendarListEntry[]> {
  const calendars: GoogleCalendarListEntry[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      maxResults: "250",
      showHidden: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const data = await googleGet<GoogleCalendarListResponse>(
      `${CALENDAR_LIST_URL}?${params.toString()}`,
      accessToken,
    );
    calendars.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return calendars;
}
