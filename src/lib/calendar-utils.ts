export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function formatWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
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

export function formatDayTitle(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
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
