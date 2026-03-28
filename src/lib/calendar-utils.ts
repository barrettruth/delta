import type { Task } from "@/core/types";
import { blendColors } from "@/lib/utils";

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function weekOffset(date: Date): number {
  return date.getDay();
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const mOpts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  const start = weekStart.toLocaleDateString("en-US", mOpts);
  if (weekStart.getFullYear() !== weekEnd.getFullYear()) {
    const end = weekEnd.toLocaleDateString("en-US", {
      ...mOpts,
      year: "numeric",
    });
    return `${start}, ${weekStart.getFullYear()} \u2013 ${end}`;
  }
  if (weekStart.getMonth() !== weekEnd.getMonth()) {
    const end = weekEnd.toLocaleDateString("en-US", mOpts);
    return `${start} \u2013 ${end}, ${weekStart.getFullYear()}`;
  }
  return `${start} \u2013 ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
}

export function formatMonthTitle(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function formatMilitaryTime(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function snapTo15Min(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(Math.round(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

export function getMinutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function statusColor(task: Task): string {
  if (task.status === "done") return "text-status-done line-through";
  if (task.status === "blocked") return "text-status-blocked";
  if (task.status === "wip") return "text-status-wip";
  if (task.status === "cancelled") return "text-status-cancelled line-through";
  return "text-foreground";
}

export function statusDot(task: Task): string {
  if (task.status === "done") return "bg-status-done";
  if (task.status === "blocked") return "bg-status-blocked";
  if (task.status === "wip") return "bg-status-wip";
  if (task.status === "cancelled") return "bg-status-cancelled";
  return "bg-status-pending";
}

export function dayBlendStyle(
  tasks: Task[],
  colors: Record<string, string>,
): React.CSSProperties | undefined {
  const hexes = tasks
    .map((t) => (t.category ? colors[t.category] : undefined))
    .filter((c): c is string => !!c);
  const blended = blendColors(hexes);
  if (!blended) return undefined;
  return { backgroundColor: `${blended}18` };
}

export const HOUR_HEIGHT = 60;

export function isMultiDay(startAt: string, endAt: string): boolean {
  const s = new Date(startAt);
  const e = new Date(endAt);
  return s.toDateString() !== e.toDateString();
}

export function getDatesBetween(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const endDay = new Date(end);
  endDay.setHours(0, 0, 0, 0);
  while (d <= endDay) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export type Continuation = "start" | "middle" | "end";

export interface TimedEntry {
  task: Task;
  continuation?: Continuation;
  timeStartMin: number;
  timeEndMin: number;
}

export interface TaskPreFill {
  due?: string;
  startAt?: string;
  endAt?: string;
  allDay?: number;
  timezone?: string;
  category?: string;
}

export function buildSlotPreFill(date: Date, minuteOfDay: number): TaskPreFill {
  const snapped = Math.round(minuteOfDay / 15) * 15;
  const hours = Math.floor(snapped / 60);
  const mins = snapped % 60;
  const start = new Date(date);
  start.setHours(hours, mins, 0, 0);
  return {
    startAt: start.toISOString(),
    due: start.toISOString(),
    allDay: 0,
    timezone: getUserTimezone(),
  };
}

export function snapMinuteTo15(minute: number): number {
  return Math.max(0, Math.min(1425, Math.round(minute / 15) * 15));
}

export function minuteToISOString(baseDate: Date, minuteOfDay: number): string {
  const d = new Date(baseDate);
  d.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
  return d.toISOString();
}

export function buildRangePreFill(
  date: Date,
  startMinute: number,
  endMinute: number,
): TaskPreFill {
  const start = new Date(date);
  start.setHours(Math.floor(startMinute / 60), startMinute % 60, 0, 0);
  const end = new Date(date);
  end.setHours(Math.floor(endMinute / 60), endMinute % 60, 0, 0);
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    due: start.toISOString(),
    allDay: 0,
    timezone: getUserTimezone(),
  };
}

export function buildDayPreFill(date: Date): TaskPreFill {
  const noon = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
    0,
    0,
  );
  return {
    startAt: noon.toISOString(),
    due: noon.toISOString(),
    allDay: 1,
    timezone: getUserTimezone(),
  };
}
