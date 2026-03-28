import { RRule, RRuleSet } from "rrule";
import { createTask, getTask, listExceptions, updateTask } from "./task";
import type { Db, Task } from "./types";

export interface ExpandedInstance {
  masterId: number;
  instanceDate: Date;
  startAt: string;
  endAt: string | null;
  exception: Task | null;
}

export function buildRRuleSet(task: Task): RRuleSet {
  if (!task.recurrence) throw new Error("Task has no recurrence rule");

  const set = new RRuleSet();

  const baseRule = RRule.fromString(task.recurrence.replace(/^RRULE:/, ""));
  const dtstart = task.startAt
    ? new Date(task.startAt)
    : task.due
      ? new Date(task.due)
      : new Date();

  const rule = new RRule({ ...baseRule.origOptions, dtstart });
  set.rrule(rule);

  if (task.exdates) {
    for (const d of JSON.parse(task.exdates) as string[]) {
      set.exdate(new Date(d));
    }
  }

  if (task.rdates) {
    for (const d of JSON.parse(task.rdates) as string[]) {
      set.rdate(new Date(d));
    }
  }

  return set;
}

export function expandInstances(
  master: Task,
  rangeStart: Date,
  rangeEnd: Date,
  exceptions: Task[],
): ExpandedInstance[] {
  if (!master.recurrence) return [];

  const set = buildRRuleSet(master);
  const dates = set.between(rangeStart, rangeEnd, true);

  const duration =
    master.startAt && master.endAt
      ? new Date(master.endAt).getTime() - new Date(master.startAt).getTime()
      : null;

  const exceptionMap = new Map<string, Task>();
  for (const exc of exceptions) {
    if (exc.originalStartAt) {
      exceptionMap.set(new Date(exc.originalStartAt).toISOString(), exc);
    }
  }

  return dates.map((date) => {
    const key = date.toISOString();
    const exception = exceptionMap.get(key) ?? null;

    return {
      masterId: master.id,
      instanceDate: date,
      startAt: exception?.startAt ?? key,
      endAt:
        exception?.endAt ??
        (duration ? new Date(date.getTime() + duration).toISOString() : null),
      exception,
    };
  });
}

export function materializeInstance(
  db: Db,
  userId: number,
  masterId: number,
  instanceDate: string,
): Task {
  const master = getTask(db, masterId);
  if (!master) throw new Error(`Master task ${masterId} not found`);
  if (!master.recurrence) throw new Error("Task has no recurrence rule");

  const duration =
    master.startAt && master.endAt
      ? new Date(master.endAt).getTime() - new Date(master.startAt).getTime()
      : null;

  const instanceStart = instanceDate;
  const instanceEnd = duration
    ? new Date(new Date(instanceDate).getTime() + duration).toISOString()
    : master.endAt;

  const exdates: string[] = master.exdates ? JSON.parse(master.exdates) : [];
  exdates.push(new Date(instanceDate).toISOString());
  updateTask(db, masterId, { exdates: JSON.stringify(exdates) });

  return createTask(db, userId, {
    description: master.description,
    status: master.status ?? "pending",
    category: master.category ?? undefined,
    due: master.due ?? undefined,
    startAt: instanceStart,
    endAt: instanceEnd ?? undefined,
    allDay: master.allDay ?? undefined,
    timezone: master.timezone ?? undefined,
    location: master.location ?? undefined,
    meetingUrl: master.meetingUrl ?? undefined,
    notes: master.notes ?? undefined,
    order: master.order ?? undefined,
    recurringTaskId: masterId,
    originalStartAt: new Date(instanceDate).toISOString(),
  });
}

export function getExceptionsForMaster(db: Db, masterId: number): Task[] {
  return listExceptions(db, masterId);
}
