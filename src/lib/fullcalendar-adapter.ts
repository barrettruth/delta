import type { EventInput } from "@fullcalendar/core";
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
  if (!task.startAt) return null;

  const isRecurring = Boolean(task.recurrence) || Boolean(task.recurringTaskId);
  const classNames: string[] = [`status-${task.status ?? "pending"}`];
  if (isRecurring) classNames.push("is-recurring");
  if (isVirtual) classNames.push("is-virtual");

  const color =
    task.category && categoryColors ? categoryColors[task.category] : undefined;

  const event: EventInput = {
    id: String(task.id),
    title: task.description,
    start: task.startAt,
    end: task.endAt ?? undefined,
    allDay: task.allDay === 1,
    classNames,
    extendedProps: {
      task,
      isVirtual,
      isRecurring,
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

    if (!task.startAt) continue;
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
