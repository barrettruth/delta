import type { Task, TaskStatus } from "../types";
import type { ReminderAnchor } from "./types";

export interface ReminderScheduleInput {
  task: Pick<Task, "due" | "startAt" | "allDay" | "timezone" | "status">;
  anchor: ReminderAnchor;
  offsetMinutes: number;
  allDayLocalTime?: string | null;
  defaultAllDayLocalTime: string;
  userTimezone: string;
}

function isValidTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function isValidLocalTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function getAnchorIso(
  task: Pick<Task, "due" | "startAt">,
  anchor: ReminderAnchor,
): string | null {
  return anchor === "due" ? task.due : task.startAt;
}

function getDatePart(iso: string): string | null {
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})T/);
  return match ? match[1] : null;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(
  datePart: string,
  timePart: string,
  timeZone: string,
): Date | null {
  if (!isValidLocalTime(timePart) || !isValidTimeZone(timeZone)) {
    return null;
  }

  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const offset = getTimeZoneOffsetMs(guess, timeZone);
  const candidate = new Date(guess.getTime() - offset);
  const correctedOffset = getTimeZoneOffsetMs(candidate, timeZone);

  if (offset === correctedOffset) {
    return candidate;
  }

  return new Date(guess.getTime() - correctedOffset);
}

export function shouldSuppressTaskReminders(status: TaskStatus): boolean {
  return status === "done" || status === "cancelled";
}

export function resolveReminderBaseTime(
  input: ReminderScheduleInput,
): Date | null {
  const anchorIso = getAnchorIso(input.task, input.anchor);
  if (!anchorIso) return null;

  if (input.task.allDay === 1) {
    const datePart = getDatePart(anchorIso);
    if (!datePart) return null;

    const preferredTime = input.allDayLocalTime ?? input.defaultAllDayLocalTime;
    if (!isValidLocalTime(preferredTime)) return null;

    const preferredZone =
      input.task.timezone && isValidTimeZone(input.task.timezone)
        ? input.task.timezone
        : input.userTimezone;

    return zonedDateTimeToUtc(datePart, preferredTime, preferredZone);
  }

  const date = new Date(anchorIso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function resolveReminderSendTime(
  input: ReminderScheduleInput,
): Date | null {
  if (shouldSuppressTaskReminders(input.task.status)) return null;

  const base = resolveReminderBaseTime(input);
  if (!base) return null;

  return new Date(base.getTime() + input.offsetMinutes * 60_000);
}
