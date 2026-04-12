import ical, { type ICalEventData, ICalEventStatus } from "ical-generator";
import type { Task } from "@/core/types";
import { notesToPlaintext } from "./notes-to-plaintext";

function taskStatusToICalStatus(status: string): ICalEventStatus | null {
  switch (status) {
    case "cancelled":
      return ICalEventStatus.CANCELLED;
    default:
      return ICalEventStatus.CONFIRMED;
  }
}

function parseDateArray(json: string | null): Date[] {
  if (!json) return [];
  try {
    const parsed: string[] = JSON.parse(json);
    return parsed.map((d) => new Date(d));
  } catch {
    return [];
  }
}

export function taskToVEvent(task: Task): ICalEventData | null {
  if (!task.startAt) return null;

  const event: ICalEventData = {
    id: `delta-task-${task.id}@delta.barrettruth.com`,
    start: new Date(task.startAt),
    summary: task.description,
    allDay: task.allDay === 1,
  };

  if (task.endAt) {
    event.end = new Date(task.endAt);
  }

  if (task.timezone) {
    event.timezone = task.timezone;
  }

  const description = notesToPlaintext(task.notes);
  if (description) {
    event.description = description;
  }

  if (task.location) {
    event.location = task.location;
  }

  if (task.meetingUrl) {
    event.url = task.meetingUrl;
  }

  if (task.recurrence) {
    event.repeating = task.recurrence;
  }

  const exdates = parseDateArray(task.exdates);
  const xEntries = (event.x as { key: string; value: string }[]) ?? [];
  if (
    exdates.length > 0 &&
    event.repeating &&
    typeof event.repeating === "string"
  ) {
    xEntries.push(
      ...exdates.map((d) => ({
        key: "EXDATE",
        value: d
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}/, ""),
      })),
    );
  }

  const rdates = parseDateArray(task.rdates);
  if (rdates.length > 0) {
    for (const d of rdates) {
      xEntries.push({
        key: "RDATE",
        value: d
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}/, ""),
      });
    }
  }

  event.status = taskStatusToICalStatus(task.status);
  xEntries.push({
    key: "X-DELTA-STATUS",
    value: task.status.toUpperCase(),
  });
  if (xEntries.length > 0) {
    event.x = xEntries;
  }

  return event;
}

export function tasksToICalendar(tasks: Task[], calendarName?: string): string {
  const cal = ical({
    name: calendarName ?? "delta",
    prodId: { company: "delta", product: "delta v0.1.0" },
  });

  for (const task of tasks) {
    const eventData = taskToVEvent(task);
    if (eventData) {
      cal.createEvent(eventData);
    }
  }

  return cal.toString();
}
