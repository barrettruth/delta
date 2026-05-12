import type { EventInput } from "@fullcalendar/core";
import type { Task } from "@/core/types";
import {
  formatDayTitle,
  formatMonthTitle,
  formatWeekRange,
  getWeekStart,
  startOfMonth,
  type TaskPreFill,
} from "@/lib/calendar-utils";
import type { FcViewMode } from "./fc-calendar";

export interface CalendarDateRange {
  start: Date;
  end: Date;
}

export type CalendarPanelMode = "edit" | "create";

export function isCalendarTimeGridView(viewMode: FcViewMode): boolean {
  return viewMode === "week" || viewMode === "day";
}

export function startOfCalendarDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addCalendarDays(date: Date, days: number): Date {
  const result = startOfCalendarDay(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getCalendarRange({
  visibleRange,
  anchor,
  viewMode,
  fallbackDate = new Date(),
}: {
  visibleRange: CalendarDateRange | null;
  anchor: Date | null;
  viewMode: FcViewMode;
  fallbackDate?: Date;
}): CalendarDateRange {
  if (visibleRange) return visibleRange;

  let rangeStart: Date;
  if (!anchor) {
    rangeStart = getWeekStart(fallbackDate);
  } else if (viewMode === "day") {
    rangeStart = new Date(anchor);
    rangeStart.setHours(0, 0, 0, 0);
  } else if (viewMode === "week") {
    rangeStart = getWeekStart(anchor);
  } else {
    rangeStart = getWeekStart(startOfMonth(anchor));
  }

  const rangeEnd = new Date(rangeStart);
  const span = viewMode === "day" ? 1 : viewMode === "week" ? 7 : 42;
  rangeEnd.setDate(rangeEnd.getDate() + span);
  return { start: rangeStart, end: rangeEnd };
}

export function getCalendarHeaderTitle(
  anchor: Date | null,
  viewMode: FcViewMode,
): string {
  if (!anchor) return "";
  if (viewMode === "day") return formatDayTitle(anchor);
  if (viewMode === "week") return formatWeekRange(getWeekStart(anchor));
  return formatMonthTitle(startOfMonth(anchor));
}

export function buildCalendarDraftEvent(
  panelMode: CalendarPanelMode,
  preFill: TaskPreFill | null,
): EventInput | null {
  if (panelMode !== "create" || !preFill) return null;
  const { startAt, endAt, allDay } = preFill;
  if (!startAt) return null;

  const start = new Date(startAt);
  let end: Date;
  if (allDay) {
    end = new Date(start);
    end.setDate(end.getDate() + 1);
  } else if (endAt) {
    end = new Date(endAt);
  } else {
    end = new Date(start.getTime() + 30 * 60_000);
  }

  return {
    id: "__draft__",
    title: "(New event)",
    start,
    end,
    allDay: Boolean(allDay),
    editable: false,
    classNames: ["is-draft"],
    extendedProps: {
      isDraft: true,
      calendarBorderColor: "var(--primary)",
    },
  };
}

function readTaskExdates(task: Task): string[] {
  return task.exdates ? JSON.parse(task.exdates) : [];
}

export function mergeOptimisticCalendarTasks(
  tasks: Task[],
  optimisticTasks: ReadonlyMap<number, Task>,
  optimisticMasterExdates: ReadonlyMap<number, string[]>,
): Task[] {
  if (optimisticTasks.size === 0 && optimisticMasterExdates.size === 0) {
    return tasks;
  }

  const byId = new Map<number, Task>();
  for (const task of tasks) byId.set(task.id, task);
  for (const [id, extra] of optimisticTasks) {
    if (!byId.has(id)) byId.set(id, extra);
  }

  if (optimisticMasterExdates.size > 0) {
    for (const [masterId, added] of optimisticMasterExdates) {
      const master = byId.get(masterId);
      if (!master) continue;
      const merged = Array.from(
        new Set([...readTaskExdates(master), ...added]),
      );
      byId.set(masterId, {
        ...master,
        exdates: JSON.stringify(merged),
      });
    }
  }

  return Array.from(byId.values());
}

export function pruneOptimisticMasterExdates(
  optimisticMasterExdates: ReadonlyMap<number, string[]>,
  tasks: Task[],
): Map<number, string[]> {
  const next = new Map(optimisticMasterExdates);

  for (const [masterId, added] of optimisticMasterExdates) {
    const master = tasks.find((task) => task.id === masterId);
    if (!master) {
      next.delete(masterId);
      continue;
    }

    const currentSet = new Set(readTaskExdates(master));
    const remaining = added.filter((date) => !currentSet.has(date));
    if (remaining.length === 0) {
      next.delete(masterId);
    } else if (remaining.length !== added.length) {
      next.set(masterId, remaining);
    }
  }

  return next;
}

export function addOptimisticMasterExdate(
  optimisticMasterExdates: ReadonlyMap<number, string[]>,
  masterId: number,
  exdateIso: string,
): Map<number, string[]> {
  const next = new Map(optimisticMasterExdates);
  const existing = next.get(masterId) ?? [];
  if (!existing.includes(exdateIso)) {
    next.set(masterId, [...existing, exdateIso]);
  }
  return next;
}
