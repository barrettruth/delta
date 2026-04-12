import type { ParameterValue, VEvent } from "node-ical";

export interface ParsedEvent {
  uid: string;
  summary: string;
  description?: string;
  dtstart: Date;
  dtend?: Date;
  allDay: boolean;
  location?: string;
  url?: string;
  rrule?: string;
  status?: string;
}

function getCustomStatus(event: VEvent): string | undefined {
  const value = event["x-delta-status"];
  if (typeof value !== "string") return undefined;
  const status = value.toLowerCase();
  if (
    status === "pending" ||
    status === "done" ||
    status === "wip" ||
    status === "blocked" ||
    status === "cancelled"
  ) {
    return status;
  }
  return undefined;
}

function extractParameterValue(
  value: ParameterValue | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  return value.val;
}

function veventToParsedEvent(event: VEvent): ParsedEvent {
  const summary = extractParameterValue(event.summary) ?? "";
  const description = extractParameterValue(event.description);
  const location = extractParameterValue(event.location);

  const allDay = event.datetype === "date";

  const parsed: ParsedEvent = {
    uid: event.uid,
    summary,
    dtstart: new Date(event.start),
    allDay,
  };

  if (description) {
    parsed.description = description;
  }

  if (event.end) {
    parsed.dtend = new Date(event.end);
  }

  if (location) {
    parsed.location = location;
  }

  if (typeof event.url === "string" && event.url.length > 0) {
    parsed.url = event.url;
  }

  if (event.rrule) {
    parsed.rrule = event.rrule.toString();
  }

  const customStatus = getCustomStatus(event);
  if (customStatus) {
    parsed.status = customStatus;
  } else if (event.status) {
    parsed.status = event.status;
  }

  return parsed;
}

export async function parseICalendar(
  icsContent: string,
): Promise<ParsedEvent[]> {
  const ical = await import("node-ical");
  const parsed = ical.parseICS(icsContent);
  const events: ParsedEvent[] = [];

  for (const key of Object.keys(parsed)) {
    const component = parsed[key];
    if (!component || component.type !== "VEVENT") continue;
    events.push(veventToParsedEvent(component as VEvent));
  }

  return events;
}
