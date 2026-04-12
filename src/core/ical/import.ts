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

function parsedEventToInput(
  event: ParsedEvent,
  defaultCategory?: string,
): CreateTaskInput {
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

  if (event.description) {
    input.notes = descriptionToNotes(event.description);
  }

  if (event.location) {
    input.location = event.location;
  }

  if (event.url && /^https?:\/\//i.test(event.url)) {
    input.meetingUrl = event.url;
  }

  if (event.rrule) {
    input.recurrence = event.rrule;
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

export function importICalEvents(
  db: Db,
  userId: number,
  events: ParsedEvent[],
  defaultCategory?: string,
): ImportResult {
  const result: ImportResult = { created: 0, skipped: 0, errors: [] };

  for (const event of events) {
    try {
      const existing = getExternalLinkByProviderId(
        db,
        userId,
        "ical",
        event.uid,
      );

      if (existing) {
        result.skipped++;
        continue;
      }

      const input = parsedEventToInput(event, defaultCategory);
      const task = createTask(db, userId, input);
      createExternalLink(db, {
        userId,
        taskId: task.id,
        provider: "ical",
        externalId: event.uid,
      });
      result.created++;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : `Failed to import ${event.uid}`;
      result.errors.push(message);
    }
  }

  return result;
}
