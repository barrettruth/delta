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

  const mode = (task.recurMode ?? "scheduled") as RecurMode;
  const nextDue = getNextOccurrence(
    task.recurrence,
    mode,
    task.due,
    task.completedAt,
  );

  if (!nextDue) return null;

  return {
    description: task.description,
    category: task.category ?? undefined,
    priority: task.priority ?? undefined,
    due: nextDue.toISOString(),
    recurrence: task.recurrence,
    recurMode: mode,
    notes: task.notes ?? undefined,
    order: task.order ?? undefined,
  };
}
