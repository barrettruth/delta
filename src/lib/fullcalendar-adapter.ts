import type { DateInput, EventInput } from "@fullcalendar/core";
import { expandInstances } from "@/core/recurrence-expansion";
import type { Task } from "@/core/types";

export interface VirtualMeta {
  masterId: number;
  instanceDate: string;
}

export interface OptimisticUpdate {
  startAt?: string;
  endAt?: string | null;
  deleted?: true;
}

export interface AdapterOptions {
  pendingEdits?: Map<number, Partial<Task>>;
  optimisticUpdates?: Map<number, OptimisticUpdate>;
  categoryColors?: Record<string, string>;
  rangeStart: Date;
  rangeEnd: Date;
}

export interface AdapterResult {
  events: EventInput[];
  virtualMeta: Map<number, VirtualMeta>;
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function dateOnlyStringToLocalDate(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return isValidDate(date) ? date : null;
}

function dateInputToDate(value: DateInput | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return isValidDate(value) ? new Date(value.getTime()) : null;
  }
  if (typeof value === "string") {
    if (DATE_ONLY_RE.test(value)) return dateOnlyStringToLocalDate(value);
    const date = new Date(value);
    return isValidDate(date) ? date : null;
  }
  if (typeof value === "number") {
    const date = new Date(value);
    return isValidDate(date) ? date : null;
  }
  const [year, month = 0, day = 1, hour = 0, minute = 0, second = 0, ms = 0] =
    value;
  const date = new Date(year, month, day, hour, minute, second, ms);
  return isValidDate(date) ? date : null;
}

function addLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return next;
}

export function hasAllDayEventInRange(
  events: EventInput[],
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();
  if (Number.isNaN(rangeStartMs) || Number.isNaN(rangeEndMs)) return false;
  if (rangeEndMs <= rangeStartMs) return false;

  return events.some((event) => {
    if (event.allDay !== true) return false;

    const eventStart = dateInputToDate(event.start);
    if (!eventStart) return false;

    const eventEnd = dateInputToDate(event.end) ?? addLocalDay(eventStart);
    const eventStartMs = eventStart.getTime();
    const eventEndMs = eventEnd.getTime();
    if (eventEndMs <= eventStartMs) return false;

    return eventStartMs < rangeEndMs && eventEndMs > rangeStartMs;
  });
}

/**
 * Encode a synthetic negative ID for a virtual (non-materialized) recurring
 * instance. Must exactly match the encoding used in the legacy calendar-view.
 */
export function syntheticIdFor(masterId: number, instanceDate: Date): number {
  return -(
    masterId * 10_000_000 +
    (Math.floor(instanceDate.getTime() / 60_000) % 10_000_000)
  );
}

function mergeTask(
  task: Task,
  pendingEdits?: Map<number, Partial<Task>>,
  optimisticUpdates?: Map<number, OptimisticUpdate>,
): Task {
  const update = optimisticUpdates?.get(task.id);
  const pending = pendingEdits?.get(task.id);
  if (!update && !pending) return task;
  return { ...task, ...pending, ...update } as Task;
}

function taskToEvent(
  task: Task,
  categoryColors: Record<string, string> | undefined,
  isVirtual: boolean,
): EventInput | null {
  // Prefer an explicit scheduled start. Otherwise fall back to `due` and
  // render the task as an all-day marker on its deadline day. Tasks with
  // neither a start nor a due date never appear on the calendar.
  const isDueOnly = !task.startAt && Boolean(task.due);
  if (!task.startAt && !isDueOnly) return null;

  const isRecurring = Boolean(task.recurrence) || Boolean(task.recurringTaskId);
  const classNames: string[] = [`status-${task.status ?? "pending"}`];
  if (isRecurring) classNames.push("is-recurring");
  if (isVirtual) classNames.push("is-virtual");

  const color =
    task.category && categoryColors ? categoryColors[task.category] : undefined;

  // For due-only tasks: a `YYYY-MM-DD` string is a pure date (all-day). A full
  // ISO timestamp still has a time component but with no duration, so we pin
  // it to the day and mark it all-day so FC shows it in the all-day row.
  const dueStart = isDueOnly
    ? (task.due as string).length === 10
      ? (task.due as string)
      : (task.due as string).slice(0, 10)
    : undefined;

  const event: EventInput = {
    id: String(task.id),
    title: task.description,
    start: isDueOnly ? (dueStart as string) : (task.startAt as string),
    end: isDueOnly ? undefined : (task.endAt ?? undefined),
    allDay: isDueOnly ? true : task.allDay === 1,
    editable: true,
    durationEditable: !isDueOnly,
    classNames,
    extendedProps: {
      task,
      isVirtual,
      isRecurring,
      isDueOnly,
    },
  };

  if (color) {
    event.backgroundColor = `${color}20`;
    event.borderColor = color;
  }

  return event;
}

/**
 * Build FullCalendar EventInput[] from delta Task[].
 *
 * Mirrors the bucket logic from the legacy CalendarView memos:
 *  - non-recurring tasks with startAt/due -> direct event
 *  - recurrence masters (recurMode === "scheduled") -> expand via expandInstances
 *  - exceptions (recurringTaskId set) consumed by their master's expansion
 *  - optimistic updates + panel pendingEdits merged in
 *  - deleted (optimistic) dropped
 *
 * Returns both the events and the virtualMeta map so the caller can map
 * synthetic ids back to {masterId, instanceDate}.
 */
export function tasksToEvents(
  tasks: Task[],
  opts: AdapterOptions,
): AdapterResult {
  const {
    pendingEdits,
    optimisticUpdates,
    categoryColors,
    rangeStart,
    rangeEnd,
  } = opts;

  const events: EventInput[] = [];
  const virtualMeta = new Map<number, VirtualMeta>();

  const masters: Task[] = [];
  const exceptionsMap = new Map<number, Task[]>();

  for (const task of tasks) {
    if (task.recurringTaskId) {
      const list = exceptionsMap.get(task.recurringTaskId) ?? [];
      list.push(task);
      exceptionsMap.set(task.recurringTaskId, list);
    }

    const isMaster =
      task.recurrence &&
      !task.recurringTaskId &&
      task.recurMode === "scheduled" &&
      (task.startAt || task.due) &&
      task.status !== "cancelled";

    if (isMaster) {
      masters.push(task);
      continue;
    }

    if (task.recurringTaskId) {
      // Handled as an exception via its master's expansion below.
      continue;
    }

    if (!task.startAt && !task.due) continue;
    if (optimisticUpdates?.get(task.id)?.deleted) continue;

    const merged = mergeTask(task, pendingEdits, optimisticUpdates);
    const ev = taskToEvent(merged, categoryColors, false);
    if (ev) events.push(ev);
  }

  for (const master of masters) {
    if (optimisticUpdates?.get(master.id)?.deleted) continue;

    const exceptions = exceptionsMap.get(master.id) ?? [];
    const instances = expandInstances(master, rangeStart, rangeEnd, exceptions);

    for (const inst of instances) {
      if (inst.exception) {
        const exc = inst.exception;
        if (exc.status === "cancelled") continue;
        if (optimisticUpdates?.get(exc.id)?.deleted) continue;
        const merged = mergeTask(exc, pendingEdits, optimisticUpdates);
        const ev = taskToEvent(merged, categoryColors, false);
        if (ev) events.push(ev);
        continue;
      }

      const syntheticId = syntheticIdFor(master.id, inst.instanceDate);

      if (optimisticUpdates?.get(syntheticId)?.deleted) continue;

      virtualMeta.set(syntheticId, {
        masterId: master.id,
        instanceDate: inst.instanceDate.toISOString(),
      });

      const virtual = {
        ...master,
        id: syntheticId,
        startAt: inst.startAt,
        endAt: inst.endAt,
      } as Task;

      const update = optimisticUpdates?.get(syntheticId);
      const merged = update ? ({ ...virtual, ...update } as Task) : virtual;
      const ev = taskToEvent(merged, categoryColors, true);
      if (ev) events.push(ev);
    }
  }

  return { events, virtualMeta };
}
