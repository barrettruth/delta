import {
  createExternalLink,
  getExternalLinkByProviderId,
} from "../external-links";
import { createTask } from "../task";
import type { CreateTaskInput, Db, TaskStatus } from "../types";
import type { ParsedEvent } from "./parser";

export interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

interface ImportTaskOptions {
  includeRecurrence?: boolean;
  recurMode?: CreateTaskInput["recurMode"];
  recurringTaskId?: number;
  originalStartAt?: string;
  exdates?: string[];
  rdates?: string[];
}

function descriptionToNotes(text: string): string {
  return JSON.stringify({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  });
}

function extractMeetingUrlFromDescription(
  description: string | undefined,
): string | undefined {
  if (!description) return undefined;

  const patterns = [
    /https?:\/\/meet\.google\.com\/[^\s<>"')]+/i,
    /https?:\/\/[\w.-]+\.zoom\.us\/j\/[^\s<>"')]+/i,
    /https?:\/\/[\w.-]+\.zoom\.us\/meetings\/[^\s<>"')]+/i,
    /https?:\/\/[\w.-]+\.zoom\.us\/launch\/[^\s<>"')]+/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) {
      return match[0];
    }
  }

  return undefined;
}

function parsedEventToInput(
  event: ParsedEvent,
  defaultCategory?: string,
  options: ImportTaskOptions = {},
): CreateTaskInput {
  const meetingUrl =
    getMeetingUrl(event.url, event.location) ??
    extractMeetingUrlFromDescription(event.description);
  const location =
    event.location && meetingUrl !== event.location ? event.location : undefined;
  const input: CreateTaskInput = {
    description: event.summary,
    status: "pending",
    category: defaultCategory ?? "Todo",
    startAt: event.dtstart.toISOString(),
    allDay: event.allDay ? 1 : 0,
  };

  if (event.dtend) {
    input.endAt = event.dtend.toISOString();
  }

  if (event.timezone) {
    input.timezone = event.timezone;
  }

  if (event.description) {
    input.notes = descriptionToNotes(event.description);
  }

  if (location) {
    input.location = location;
  }

  if (meetingUrl) {
    input.meetingUrl = meetingUrl;
  }

  if (event.rrule && options.includeRecurrence !== false) {
    input.recurrence = event.rrule;
    input.recurMode = options.recurMode ?? "scheduled";
  }

  if (options.exdates && options.exdates.length > 0) {
    input.exdates = JSON.stringify(options.exdates);
  }

  if (options.rdates && options.rdates.length > 0) {
    input.rdates = JSON.stringify(options.rdates);
  }

  if (options.recurringTaskId) {
    input.recurringTaskId = options.recurringTaskId;
  }

  if (options.originalStartAt) {
    input.originalStartAt = options.originalStartAt;
  }

  const status = normalizeStatus(event.status);
  if (status) {
    input.status = status;
  }

  return input;
}

function normalizeStatus(status: string | undefined): TaskStatus | null {
  if (!status) return null;
  if (
    status === "pending" ||
    status === "done" ||
    status === "wip" ||
    status === "blocked" ||
    status === "cancelled"
  ) {
    return status;
  }
  if (status.toUpperCase() === "CANCELLED") {
    return "cancelled";
  }
  return null;
}

function looksLikeMeetingUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(meet\.google\.com|[\w.-]+\.zoom\.us)\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return null;
}

function getMeetingUrl(
  url: string | undefined,
  location: string | undefined,
): string | undefined {
  return looksLikeMeetingUrl(url) ?? looksLikeMeetingUrl(location) ?? undefined;
}

function eventExternalId(event: ParsedEvent): string {
  if (event.recurrenceId) {
    return `${event.uid}::${event.recurrenceId.toISOString()}`;
  }
  return event.uid;
}

function uniqueIsoDates(dates: Date[] | undefined): string[] {
  if (!dates || dates.length === 0) return [];
  return [...new Set(dates.map((date) => date.toISOString()))];
}

function importSingleEvent(
  db: Db,
  userId: number,
  event: ParsedEvent,
  defaultCategory: string | undefined,
  result: ImportResult,
): void {
  const externalId = eventExternalId(event);
  const existing = getExternalLinkByProviderId(db, userId, "ical", externalId);
  if (existing) {
    result.skipped++;
    return;
  }

  const input = parsedEventToInput(event, defaultCategory);
  const task = createTask(db, userId, input);
  createExternalLink(db, {
    userId,
    taskId: task.id,
    provider: "ical",
    externalId,
  });
  result.created++;
}

function importRecurringGroup(
  db: Db,
  userId: number,
  events: ParsedEvent[],
  defaultCategory: string | undefined,
  result: ImportResult,
): void {
  const master =
    events.find((event) => !event.recurrenceId && !!event.rrule) ??
    events.find((event) => !event.recurrenceId);

  if (!master) {
    for (const event of events) {
      importSingleEvent(db, userId, event, defaultCategory, result);
    }
    return;
  }

  const masterExternalId = eventExternalId(master);
  let masterTaskId: number | null = null;
  const existingMaster = getExternalLinkByProviderId(
    db,
    userId,
    "ical",
    masterExternalId,
  );

  if (existingMaster) {
    masterTaskId = existingMaster.taskId;
    result.skipped++;
  } else {
    const exdateSet = new Set(uniqueIsoDates(master.exdates));
    const rdateSet = new Set(uniqueIsoDates(master.rdates));

    for (const event of events) {
      if (!event.recurrenceId) continue;
      exdateSet.add(event.recurrenceId.toISOString());
    }

    const masterTask = createTask(
      db,
      userId,
      parsedEventToInput(master, defaultCategory, {
        exdates: [...exdateSet],
        rdates: [...rdateSet],
      }),
    );
    masterTaskId = masterTask.id;
    createExternalLink(db, {
      userId,
      taskId: masterTask.id,
      provider: "ical",
      externalId: masterExternalId,
    });
    result.created++;
  }

  if (!masterTaskId) return;

  for (const event of events) {
    if (!event.recurrenceId) continue;

    const externalId = eventExternalId(event);
    const existing = getExternalLinkByProviderId(db, userId, "ical", externalId);
    if (existing) {
      result.skipped++;
      continue;
    }

    if (normalizeStatus(event.status) === "cancelled") {
      result.skipped++;
      continue;
    }

    const task = createTask(
      db,
      userId,
      parsedEventToInput(event, defaultCategory, {
        includeRecurrence: false,
        recurringTaskId: masterTaskId,
        originalStartAt: event.recurrenceId.toISOString(),
      }),
    );
    createExternalLink(db, {
      userId,
      taskId: task.id,
      provider: "ical",
      externalId,
    });
    result.created++;
  }
}

export function importICalEvents(
  db: Db,
  userId: number,
  events: ParsedEvent[],
  defaultCategory?: string,
): ImportResult {
  const result: ImportResult = { created: 0, skipped: 0, errors: [] };
  const groupedEvents = new Map<string, ParsedEvent[]>();

  for (const event of events) {
    const group = groupedEvents.get(event.uid) ?? [];
    group.push(event);
    groupedEvents.set(event.uid, group);
  }

  for (const group of groupedEvents.values()) {
    try {
      const hasRecurringMetadata = group.some(
        (event) =>
          !!event.rrule || !!event.recurrenceId || !!event.exdates?.length || !!event.rdates?.length,
      );

      if (group.length === 1 && !hasRecurringMetadata) {
        importSingleEvent(db, userId, group[0], defaultCategory, result);
      } else {
        importRecurringGroup(db, userId, group, defaultCategory, result);
      }
    } catch (e) {
      const message =
        e instanceof Error ? e.message : `Failed to import ${group[0]?.uid ?? "event"}`;
      result.errors.push(message);
    }
  }

  return result;
}
