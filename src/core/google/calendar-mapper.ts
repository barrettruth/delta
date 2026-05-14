import { EXTERNAL_LINK_PROVIDER } from "@/core/external-link-providers";
import type { CreateTaskInput, TaskStatus } from "@/core/types";
import type {
  GoogleCalendarEvent,
  GoogleCalendarEventDateTime,
  GoogleCalendarSourceSummary,
} from "./types";

interface Mark {
  type: "bold" | "italic" | "link";
  attrs?: Record<string, string>;
}

interface TextRun {
  type: "text";
  text: string;
  marks?: Mark[];
}

export interface GoogleCalendarMappedEvent {
  provider: typeof EXTERNAL_LINK_PROVIDER.googleCalendar;
  externalId: string;
  calendarId: string;
  eventId: string;
  iCalUID: string | null;
  recurringMasterExternalId: string | null;
  originalStartAt: string | null;
  input: CreateTaskInput;
  metadata: Record<string, unknown>;
}

export interface GoogleCalendarCancelledEvent {
  externalId: string;
  calendarId: string;
  eventId: string;
  recurringMasterExternalId: string | null;
  originalStartAt: string | null;
  metadata: Record<string, unknown>;
}

export interface GoogleCalendarMapResult {
  events: GoogleCalendarMappedEvent[];
  cancelledEvents: GoogleCalendarCancelledEvent[];
  duplicateSkipped: number;
  cancelledInstances: number;
  errors: string[];
}

export interface GoogleCalendarMapOptions {
  existingICalUIDs?: Set<string>;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cloneMarks(marks: Mark[]): Mark[] | undefined {
  return marks.length > 0 ? marks.map((mark) => ({ ...mark })) : undefined;
}

function descriptionToNotes(description: string): string | undefined {
  const tokens = description.split(/(<[^>]+>)/g);
  const marks: Mark[] = [];
  const runs: Array<TextRun | "\n"> = [];

  for (const token of tokens) {
    if (!token) continue;
    if (!token.startsWith("<")) {
      const text = decodeHtml(token);
      if (text) runs.push({ type: "text", text, marks: cloneMarks(marks) });
      continue;
    }

    const tag = token.toLowerCase();
    if (/^<br\b/.test(tag) || /^<\/p\b/.test(tag) || /^<\/div\b/.test(tag)) {
      runs.push("\n");
    } else if (/^<li\b/.test(tag)) {
      runs.push("\n");
      runs.push({ type: "text", text: "- ", marks: cloneMarks(marks) });
    } else if (/^<(strong|b)\b/.test(tag)) {
      marks.push({ type: "bold" });
    } else if (/^<\/(strong|b)\b/.test(tag)) {
      const index = marks.findLastIndex((mark) => mark.type === "bold");
      if (index >= 0) marks.splice(index, 1);
    } else if (/^<(em|i)\b/.test(tag)) {
      marks.push({ type: "italic" });
    } else if (/^<\/(em|i)\b/.test(tag)) {
      const index = marks.findLastIndex((mark) => mark.type === "italic");
      if (index >= 0) marks.splice(index, 1);
    } else if (/^<a\b/.test(tag)) {
      const href = token.match(/\bhref=["']([^"']+)["']/i)?.[1];
      if (href) marks.push({ type: "link", attrs: { href } });
    } else if (/^<\/a\b/.test(tag)) {
      const index = marks.findLastIndex((mark) => mark.type === "link");
      if (index >= 0) marks.splice(index, 1);
    }
  }

  const paragraphs: TextRun[][] = [[]];
  for (const run of runs) {
    if (run === "\n") {
      if (paragraphs.at(-1)?.length) paragraphs.push([]);
      continue;
    }
    paragraphs.at(-1)?.push(run);
  }

  const content = paragraphs
    .filter((paragraph) => paragraph.some((run) => run.text.trim().length > 0))
    .map((paragraph) => ({
      type: "paragraph",
      content: paragraph,
    }));

  if (content.length === 0) return undefined;
  return JSON.stringify({ type: "doc", content });
}

function dateTimeToTaskDate(
  value: GoogleCalendarEventDateTime | undefined,
): { value: string; allDay: boolean; timezone?: string } | null {
  if (!value) return null;
  if (value.date) {
    return { value: value.date, allDay: true, timezone: value.timeZone };
  }
  if (value.dateTime) {
    const date = new Date(value.dateTime);
    return {
      value: Number.isNaN(date.getTime()) ? value.dateTime : date.toISOString(),
      allDay: false,
      timezone: value.timeZone,
    };
  }
  return null;
}

function eventExternalId(calendarId: string, eventId: string): string {
  return `${calendarId}:${eventId}`;
}

function sourceAttributes(source: GoogleCalendarSourceSummary) {
  return {
    calendarId: source.sourceId,
    title: source.title,
    defaultCategory: source.defaultCategory,
    hidden: source.hidden,
    accessRole: source.accessRole,
    timeZone: source.timeZone,
    backgroundColor: source.backgroundColor,
    foregroundColor: source.foregroundColor,
  };
}

function isPrivateHiddenDetail(event: GoogleCalendarEvent): boolean {
  return (
    event.visibility === "private" &&
    !event.description &&
    !event.location &&
    !event.conferenceData &&
    (!event.summary || event.summary.toLowerCase() === "busy")
  );
}

function eventTitle(event: GoogleCalendarEvent): string {
  if (isPrivateHiddenDetail(event)) return "private event";
  return event.summary?.trim() || "(untitled Google event)";
}

function statusFor(event: GoogleCalendarEvent): TaskStatus {
  return event.status === "cancelled" ? "cancelled" : "pending";
}

function normalizeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function looksLikeMeetingUrl(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) return null;
  const normalized = normalizeHttpUrl(trimmed) ?? `https://${trimmed}`;
  try {
    const host = new URL(normalized).host;
    if (host === "meet.google.com" || host.endsWith(".zoom.us")) {
      return normalized;
    }
  } catch {
    return null;
  }
  if (/^(meet\.google\.com|[\w.-]+\.zoom\.us)\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return null;
}

function conferenceMeetingUrl(event: GoogleCalendarEvent): string | null {
  const entryPoints = event.conferenceData?.entryPoints;
  if (!Array.isArray(entryPoints)) return null;

  for (const entry of entryPoints) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const uri = looksLikeMeetingUrl(record.uri);
    const type = record.entryPointType;
    if (uri && (type === "video" || type === "hangoutsMeet")) return uri;
  }

  return null;
}

function descriptionMeetingUrl(description: string | undefined): string | null {
  if (!description) return null;
  const match = description.match(
    /https?:\/\/(?:meet\.google\.com|[\w.-]+\.zoom\.us)\/[^\s<>"')]+/i,
  );
  return match?.[0] ?? null;
}

function meetingUrl(event: GoogleCalendarEvent): string | null {
  return (
    conferenceMeetingUrl(event) ??
    normalizeHttpUrl(event.hangoutLink) ??
    looksLikeMeetingUrl(event.location) ??
    descriptionMeetingUrl(event.description)
  );
}

function parseGoogleRecurrenceDate(value: string): string | null {
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/,
  );
  if (!match) return null;
  const date = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6]),
    ),
  );
  return date.toISOString();
}

function recurrenceDates(
  lines: string[] | undefined,
  prefix: string,
): string[] {
  if (!lines) return [];
  const values: string[] = [];
  for (const line of lines) {
    if (!line.toUpperCase().startsWith(prefix)) continue;
    if (!line.includes(":")) continue;
    const rawValues = line.slice(line.indexOf(":") + 1).split(",");
    for (const rawValue of rawValues) {
      const parsed = parseGoogleRecurrenceDate(rawValue.trim());
      if (parsed) values.push(parsed);
    }
  }
  return values;
}

function recurrenceRule(lines: string[] | undefined): string | undefined {
  const line = lines?.find((item) => item.toUpperCase().startsWith("RRULE"));
  if (!line) return undefined;
  return line.replace(/^RRULE:/i, "");
}

function originalStartAt(event: GoogleCalendarEvent): string | null {
  return dateTimeToTaskDate(event.originalStartTime)?.value ?? null;
}

function metadataFor(
  source: GoogleCalendarSourceSummary,
  event: GoogleCalendarEvent,
  privateHidden: boolean,
): Record<string, unknown> {
  return {
    calendarId: source.sourceId,
    eventId: event.id,
    htmlLink: event.htmlLink ?? null,
    iCalUID: event.iCalUID ?? null,
    etag: event.etag ?? null,
    updated: event.updated ?? null,
    sequence: event.sequence ?? null,
    eventType: event.eventType ?? "default",
    status: event.status ?? null,
    visibility: event.visibility ?? null,
    transparency: event.transparency ?? null,
    sourceCalendar: sourceAttributes(source),
    start: event.start ?? null,
    end: event.end ?? null,
    originalStartTime: event.originalStartTime ?? null,
    recurringEventId: event.recurringEventId ?? null,
    recurrence: event.recurrence ?? [],
    descriptionRaw: event.description ?? null,
    privacy: privateHidden ? "[private]" : null,
    conferenceData: event.conferenceData ?? null,
    hangoutLink: event.hangoutLink ?? null,
    attendees: event.attendees ?? [],
    attendeesOmitted: event.attendeesOmitted === true,
    attachments: event.attachments ?? [],
    organizer: event.organizer ?? null,
    creator: event.creator ?? null,
    reminders: event.reminders ?? null,
    source: event.source ?? null,
    extendedProperties: event.extendedProperties ?? null,
    raw: event,
  };
}

function mapSingleEvent(
  source: GoogleCalendarSourceSummary,
  event: GoogleCalendarEvent,
  exdates: string[] = [],
): GoogleCalendarMappedEvent {
  const start = dateTimeToTaskDate(event.start);
  if (!start) throw new Error(`Google Calendar event ${event.id} has no start`);
  const end = dateTimeToTaskDate(event.end);
  const eventMeetingUrl = meetingUrl(event);
  const privateHidden = isPrivateHiddenDetail(event);
  const recurrence = recurrenceRule(event.recurrence);
  const rdates = recurrenceDates(event.recurrence, "RDATE");
  const metadata = metadataFor(source, event, privateHidden);
  const input: CreateTaskInput = {
    description: eventTitle(event),
    status: statusFor(event),
    category: source.defaultCategory,
    startAt: start.value,
    allDay: start.allDay ? 1 : 0,
  };

  if (end) input.endAt = end.value;
  if (!start.allDay && (start.timezone || end?.timezone || source.timeZone)) {
    input.timezone = start.timezone ?? end?.timezone ?? source.timeZone ?? "";
  }
  if (event.description && !privateHidden) {
    input.notes = descriptionToNotes(event.description);
  }
  if (event.location && event.location !== eventMeetingUrl) {
    input.location = event.location;
  }
  if (eventMeetingUrl) input.meetingUrl = eventMeetingUrl;
  if (recurrence) {
    input.recurrence = recurrence;
    input.recurMode = "scheduled";
  }
  if (exdates.length > 0) input.exdates = JSON.stringify([...new Set(exdates)]);
  if (rdates.length > 0) input.rdates = JSON.stringify([...new Set(rdates)]);
  const original = originalStartAt(event);
  if (original) input.originalStartAt = original;

  return {
    provider: EXTERNAL_LINK_PROVIDER.googleCalendar,
    externalId: eventExternalId(source.sourceId, event.id),
    calendarId: source.sourceId,
    eventId: event.id,
    iCalUID: event.iCalUID ?? null,
    recurringMasterExternalId: event.recurringEventId
      ? eventExternalId(source.sourceId, event.recurringEventId)
      : null,
    originalStartAt: original,
    input,
    metadata,
  };
}

function shouldSkipDuplicate(
  event: GoogleCalendarEvent,
  existingICalUIDs: Set<string> | undefined,
): boolean {
  return Boolean(event.iCalUID && existingICalUIDs?.has(event.iCalUID));
}

export function mapGoogleCalendarEvents(
  source: GoogleCalendarSourceSummary,
  events: GoogleCalendarEvent[],
  options: GoogleCalendarMapOptions = {},
): GoogleCalendarMapResult {
  const result: GoogleCalendarMapResult = {
    events: [],
    cancelledEvents: [],
    duplicateSkipped: 0,
    cancelledInstances: 0,
    errors: [],
  };
  const byRecurringMaster = new Map<string, GoogleCalendarEvent[]>();
  const masterIds = new Set(
    events.filter((event) => !event.recurringEventId).map((event) => event.id),
  );

  for (const event of events) {
    if (shouldSkipDuplicate(event, options.existingICalUIDs)) {
      result.duplicateSkipped++;
      continue;
    }
    if (event.recurringEventId) {
      const group = byRecurringMaster.get(event.recurringEventId) ?? [];
      group.push(event);
      byRecurringMaster.set(event.recurringEventId, group);
    }
  }

  for (const event of events) {
    if (shouldSkipDuplicate(event, options.existingICalUIDs)) continue;
    try {
      if (event.recurringEventId) {
        if (event.status === "cancelled") {
          result.cancelledEvents.push({
            externalId: eventExternalId(source.sourceId, event.id),
            calendarId: source.sourceId,
            eventId: event.id,
            recurringMasterExternalId: eventExternalId(
              source.sourceId,
              event.recurringEventId,
            ),
            originalStartAt: originalStartAt(event),
            metadata: metadataFor(source, event, false),
          });
          if (!masterIds.has(event.recurringEventId)) {
            result.cancelledInstances++;
          }
          continue;
        }
        result.events.push(mapSingleEvent(source, event));
        continue;
      }

      const exceptions = byRecurringMaster.get(event.id) ?? [];
      const exceptionDates = exceptions
        .map(originalStartAt)
        .filter((date): date is string => Boolean(date));
      const cancelledDates = exceptions
        .filter((item) => item.status === "cancelled")
        .map(originalStartAt)
        .filter((date): date is string => Boolean(date));
      const exdates = [
        ...recurrenceDates(event.recurrence, "EXDATE"),
        ...exceptionDates,
      ];
      result.cancelledInstances += cancelledDates.length;
      result.events.push(mapSingleEvent(source, event, exdates));
    } catch (error) {
      result.errors.push(
        error instanceof Error
          ? error.message
          : `Failed to map Google Calendar event ${event.id}`,
      );
    }
  }

  return result;
}
