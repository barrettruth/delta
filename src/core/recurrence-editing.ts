import { eq } from "drizzle-orm";
import { RRule } from "rrule";
import { tasks } from "@/db/schema";
import { buildRRuleSet } from "./recurrence-expansion";
import { createTask, getTask, updateTask } from "./task";
import type { Db, Task, UpdateTaskInput } from "./types";

export function editThisInstance(
  db: Db,
  userId: number,
  masterId: number,
  instanceDate: string,
  updates: UpdateTaskInput,
): Task {
  const master = getTask(db, masterId);
  if (!master || !master.recurrence) {
    throw new Error("Invalid master task");
  }

  const normalizedDate = new Date(instanceDate).toISOString();

  const exdates: string[] = master.exdates
    ? JSON.parse(master.exdates)
    : [];
  exdates.push(normalizedDate);
  updateTask(db, masterId, { exdates: JSON.stringify(exdates) });

  const duration =
    master.startAt && master.endAt
      ? new Date(master.endAt).getTime() - new Date(master.startAt).getTime()
      : null;
  const instanceEnd = duration
    ? new Date(new Date(instanceDate).getTime() + duration).toISOString()
    : master.endAt;

  return createTask(db, userId, {
    description:
      updates.description !== undefined
        ? (updates.description ?? master.description)
        : master.description,
    status:
      updates.status !== undefined
        ? (updates.status ?? master.status ?? "pending")
        : (master.status ?? "pending"),
    category:
      updates.category !== undefined
        ? (updates.category ?? undefined)
        : (master.category ?? undefined),
    label:
      updates.label !== undefined
        ? (updates.label ?? undefined)
        : (master.label ?? undefined),
    due:
      updates.due !== undefined
        ? (updates.due ?? undefined)
        : (master.due ?? undefined),
    startAt:
      updates.startAt !== undefined
        ? (updates.startAt ?? undefined)
        : instanceDate,
    endAt:
      updates.endAt !== undefined
        ? (updates.endAt ?? undefined)
        : (instanceEnd ?? undefined),
    allDay:
      updates.allDay !== undefined
        ? (updates.allDay ?? undefined)
        : (master.allDay ?? undefined),
    timezone:
      updates.timezone !== undefined
        ? (updates.timezone ?? undefined)
        : (master.timezone ?? undefined),
    location:
      updates.location !== undefined
        ? (updates.location ?? undefined)
        : (master.location ?? undefined),
    meetingUrl:
      updates.meetingUrl !== undefined
        ? (updates.meetingUrl ?? undefined)
        : (master.meetingUrl ?? undefined),
    notes:
      updates.notes !== undefined
        ? (updates.notes ?? undefined)
        : (master.notes ?? undefined),
    order: master.order ?? undefined,
    recurringTaskId: masterId,
    originalStartAt: normalizedDate,
  });
}

export function editThisAndFuture(
  db: Db,
  userId: number,
  masterId: number,
  instanceDate: string,
  updates: UpdateTaskInput,
): Task {
  const master = getTask(db, masterId);
  if (!master || !master.recurrence) {
    throw new Error("Invalid master task");
  }

  const cutoff = new Date(new Date(instanceDate).getTime() - 1000);
  const baseRule = RRule.fromString(master.recurrence.replace(/^RRULE:/, ""));
  const truncated = new RRule({
    ...baseRule.origOptions,
    until: cutoff,
    count: undefined,
  });
  updateTask(db, masterId, { recurrence: truncated.toString() });

  const newMaster = createTask(db, userId, {
    description:
      updates.description !== undefined
        ? (updates.description ?? master.description)
        : master.description,
    status: master.status ?? "pending",
    category:
      updates.category !== undefined
        ? (updates.category ?? undefined)
        : (master.category ?? undefined),
    label:
      updates.label !== undefined
        ? (updates.label ?? undefined)
        : (master.label ?? undefined),
    due:
      updates.due !== undefined
        ? (updates.due ?? undefined)
        : (master.due ?? undefined),
    startAt:
      updates.startAt !== undefined
        ? (updates.startAt ?? undefined)
        : instanceDate,
    endAt:
      updates.endAt !== undefined
        ? (updates.endAt ?? undefined)
        : (master.endAt ?? undefined),
    allDay:
      updates.allDay !== undefined
        ? (updates.allDay ?? undefined)
        : (master.allDay ?? undefined),
    timezone:
      updates.timezone !== undefined
        ? (updates.timezone ?? undefined)
        : (master.timezone ?? undefined),
    location:
      updates.location !== undefined
        ? (updates.location ?? undefined)
        : (master.location ?? undefined),
    meetingUrl:
      updates.meetingUrl !== undefined
        ? (updates.meetingUrl ?? undefined)
        : (master.meetingUrl ?? undefined),
    notes:
      updates.notes !== undefined
        ? (updates.notes ?? undefined)
        : (master.notes ?? undefined),
    order: master.order ?? undefined,
    recurrence: master.recurrence,
    recurMode: master.recurMode ?? undefined,
  });

  const normalizedDate = new Date(instanceDate).toISOString();
  const futureExceptions = db
    .select()
    .from(tasks)
    .where(eq(tasks.recurringTaskId, masterId))
    .all()
    .filter(
      (t) =>
        t.originalStartAt &&
        new Date(t.originalStartAt).getTime() >= new Date(normalizedDate).getTime(),
    );

  for (const exc of futureExceptions) {
    db.update(tasks)
      .set({ recurringTaskId: newMaster.id })
      .where(eq(tasks.id, exc.id))
      .run();
  }

  return newMaster;
}

export function editAllInstances(
  db: Db,
  _userId: number,
  masterId: number,
  updates: UpdateTaskInput,
): Task {
  return updateTask(db, masterId, updates);
}

export function deleteThisInstance(
  db: Db,
  _userId: number,
  masterId: number,
  instanceDate: string,
): void {
  const master = getTask(db, masterId);
  if (!master || !master.recurrence) {
    throw new Error("Invalid master task");
  }

  const normalizedDate = new Date(instanceDate).toISOString();

  const exdates: string[] = master.exdates
    ? JSON.parse(master.exdates)
    : [];
  exdates.push(normalizedDate);
  updateTask(db, masterId, { exdates: JSON.stringify(exdates) });

  const existing = db
    .select()
    .from(tasks)
    .where(eq(tasks.recurringTaskId, masterId))
    .all()
    .find(
      (t) =>
        t.originalStartAt &&
        new Date(t.originalStartAt).toISOString() === normalizedDate,
    );
  if (existing) {
    updateTask(db, existing.id, { status: "cancelled" });
  }
}

export function deleteThisAndFuture(
  db: Db,
  _userId: number,
  masterId: number,
  instanceDate: string,
): void {
  const master = getTask(db, masterId);
  if (!master || !master.recurrence) {
    throw new Error("Invalid master task");
  }

  const cutoff = new Date(new Date(instanceDate).getTime() - 1000);
  const baseRule = RRule.fromString(master.recurrence.replace(/^RRULE:/, ""));
  const truncated = new RRule({
    ...baseRule.origOptions,
    until: cutoff,
    count: undefined,
  });
  updateTask(db, masterId, { recurrence: truncated.toString() });

  const normalizedDate = new Date(instanceDate).toISOString();
  const futureExceptions = db
    .select()
    .from(tasks)
    .where(eq(tasks.recurringTaskId, masterId))
    .all()
    .filter(
      (t) =>
        t.originalStartAt &&
        new Date(t.originalStartAt).getTime() >= new Date(normalizedDate).getTime(),
    );

  for (const exc of futureExceptions) {
    updateTask(db, exc.id, { status: "cancelled" });
  }
}

export function deleteAllInstances(db: Db, masterId: number): void {
  const exceptions = db
    .select()
    .from(tasks)
    .where(eq(tasks.recurringTaskId, masterId))
    .all();

  for (const exc of exceptions) {
    updateTask(db, exc.id, { status: "cancelled" });
  }

  updateTask(db, masterId, { status: "cancelled" });
}
