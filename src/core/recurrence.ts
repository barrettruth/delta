import { RRule } from "rrule";
import type { CreateTaskInput, RecurMode, Task } from "./types";

export function parseRRule(str: string): RRule {
  return RRule.fromString(str.replace(/^RRULE:/, ""));
}

export function getNextOccurrence(
  rruleStr: string,
  mode: RecurMode,
  currentDue: string | null,
  completedAt: string,
): Date | null {
  if (mode === "scheduled") {
    const rule = parseRRule(rruleStr);
    const ref = currentDue ? new Date(currentDue) : new Date(completedAt);
    return rule.after(ref);
  }

  const base = parseRRule(rruleStr);
  const rule = new RRule({
    ...base.origOptions,
    dtstart: new Date(completedAt),
  });
  return rule.after(new Date(completedAt));
}

export function getNextTaskData(task: Task): CreateTaskInput | null {
  if (!task.recurrence || !task.completedAt) return null;

  const mode: RecurMode = task.recurMode ?? "scheduled";
  const nextDue = getNextOccurrence(
    task.recurrence,
    mode,
    task.due,
    task.completedAt,
  );

  if (!nextDue) return null;

  const dueDelta = task.due
    ? nextDue.getTime() - new Date(task.due).getTime()
    : 0;

  let startAt: string | undefined;
  if (task.startAt) {
    startAt = new Date(
      new Date(task.startAt).getTime() + dueDelta,
    ).toISOString();
  }

  let endAt: string | undefined;
  if (task.endAt) {
    endAt = new Date(new Date(task.endAt).getTime() + dueDelta).toISOString();
  }

  return {
    description: task.description,
    category: task.category ?? undefined,
    label: task.label ?? undefined,
    due: nextDue.toISOString(),
    startAt,
    endAt,
    allDay: task.allDay ?? undefined,
    timezone: task.timezone ?? undefined,
    recurrence: task.recurrence,
    recurMode: mode,
    notes: task.notes ?? undefined,
    order: task.order ?? undefined,
  };
}
