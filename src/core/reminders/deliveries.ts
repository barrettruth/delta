import { and, asc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  reminderDeliveries,
  reminderEndpoints,
  taskReminders,
  tasks,
} from "@/db/schema";
import type { Db, Task } from "../types";
import { resolveReminderSendTime } from "./schedule";
import type { ReminderDelivery } from "./types";

export const MAX_REMINDER_ATTEMPTS = 5;

function timestamp(): string {
  return new Date().toISOString();
}

export function buildReminderDedupeKey(input: {
  userId: number;
  taskId: number;
  taskReminderId: number;
  endpointId: number;
  scheduledFor: string;
}): string {
  return [
    input.userId,
    input.taskId,
    input.taskReminderId,
    input.endpointId,
    input.scheduledFor,
  ].join(":");
}

export function computeReminderRetryDelayMinutes(attempts: number): number {
  if (attempts <= 1) return 1;
  if (attempts === 2) return 5;
  if (attempts === 3) return 15;
  return 60;
}

export function computeReminderRetryTime(
  attemptedAt: string,
  attempts: number,
): string {
  const delayMs = computeReminderRetryDelayMinutes(attempts) * 60_000;
  return new Date(new Date(attemptedAt).getTime() + delayMs).toISOString();
}

export function getReminderDelivery(
  db: Db,
  id: number,
): ReminderDelivery | null {
  const row = db
    .select()
    .from(reminderDeliveries)
    .where(eq(reminderDeliveries.id, id))
    .get();

  return row ?? null;
}

export function enqueueReminderDelivery(
  db: Db,
  input: {
    userId: number;
    taskId: number;
    taskReminderId: number;
    endpointId: number;
    adapterKey: ReminderDelivery["adapterKey"];
    scheduledFor: string;
  },
): ReminderDelivery {
  const dedupeKey = buildReminderDedupeKey({
    userId: input.userId,
    taskId: input.taskId,
    taskReminderId: input.taskReminderId,
    endpointId: input.endpointId,
    scheduledFor: input.scheduledFor,
  });
  const now = timestamp();

  db.insert(reminderDeliveries)
    .values({
      userId: input.userId,
      taskId: input.taskId,
      taskReminderId: input.taskReminderId,
      endpointId: input.endpointId,
      adapterKey: input.adapterKey,
      dedupeKey,
      scheduledFor: input.scheduledFor,
      status: "pending",
      attempts: 0,
      nextAttemptAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({ target: reminderDeliveries.dedupeKey })
    .run();

  const row = db
    .select()
    .from(reminderDeliveries)
    .where(eq(reminderDeliveries.dedupeKey, dedupeKey))
    .get();

  if (!row) {
    throw new Error(`Failed to enqueue reminder delivery ${dedupeKey}`);
  }

  return row;
}

export function listDispatchableReminderDeliveries(
  db: Db,
  nowIso: string,
  limit = 50,
): ReminderDelivery[] {
  return db
    .select()
    .from(reminderDeliveries)
    .where(
      and(
        inArray(reminderDeliveries.status, ["pending", "failed"]),
        lte(reminderDeliveries.scheduledFor, nowIso),
        or(
          isNull(reminderDeliveries.nextAttemptAt),
          lte(reminderDeliveries.nextAttemptAt, nowIso),
        ),
      ),
    )
    .orderBy(asc(reminderDeliveries.scheduledFor), asc(reminderDeliveries.id))
    .limit(limit)
    .all();
}

export function claimReminderDelivery(
  db: Db,
  id: number,
  nowIso: string,
): ReminderDelivery | null {
  const row = db
    .update(reminderDeliveries)
    .set({
      status: "sending",
      attempts: sql`${reminderDeliveries.attempts} + 1`,
      lastAttemptAt: nowIso,
      updatedAt: nowIso,
    })
    .where(
      and(
        eq(reminderDeliveries.id, id),
        inArray(reminderDeliveries.status, ["pending", "failed"]),
        lte(reminderDeliveries.scheduledFor, nowIso),
        or(
          isNull(reminderDeliveries.nextAttemptAt),
          lte(reminderDeliveries.nextAttemptAt, nowIso),
        ),
      ),
    )
    .returning()
    .get();

  return row ?? null;
}

export function markReminderDeliverySent(
  db: Db,
  id: number,
  input: {
    providerMessageId?: string | null;
    renderedBody?: string | null;
  } = {},
): ReminderDelivery | null {
  const now = timestamp();
  const row = db
    .update(reminderDeliveries)
    .set({
      status: "sent",
      providerMessageId: input.providerMessageId ?? null,
      renderedBody: input.renderedBody ?? null,
      sentAt: now,
      nextAttemptAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(reminderDeliveries.id, id),
        eq(reminderDeliveries.status, "sending"),
      ),
    )
    .returning()
    .get();

  return row ?? null;
}

export function markReminderDeliveryFailed(
  db: Db,
  id: number,
  error: string,
  retryable = true,
): ReminderDelivery | null {
  const existing = getReminderDelivery(db, id);
  if (!existing || existing.status !== "sending") return null;

  const now = timestamp();
  const attemptedAt = existing.lastAttemptAt ?? now;
  const exhausted = !retryable || existing.attempts >= MAX_REMINDER_ATTEMPTS;

  const row = db
    .update(reminderDeliveries)
    .set({
      status: exhausted ? "dead" : "failed",
      error,
      nextAttemptAt: exhausted
        ? null
        : computeReminderRetryTime(attemptedAt, existing.attempts),
      updatedAt: now,
    })
    .where(eq(reminderDeliveries.id, id))
    .returning()
    .get();

  return row ?? null;
}

export function suppressPendingReminderDeliveriesForTask(
  db: Db,
  taskId: number,
): number {
  const result = db
    .update(reminderDeliveries)
    .set({
      status: "suppressed",
      nextAttemptAt: null,
      updatedAt: timestamp(),
    })
    .where(
      and(
        eq(reminderDeliveries.taskId, taskId),
        inArray(reminderDeliveries.status, ["pending", "failed"]),
      ),
    )
    .run();

  return result.changes;
}

export function enqueueDueReminderDeliveries(
  db: Db,
  input: {
    nowIso: string;
    userTimezoneResolver: (userId: number) => string;
  },
): ReminderDelivery[] {
  const joined = db
    .select({
      reminder: taskReminders,
      task: tasks,
      endpoint: reminderEndpoints,
    })
    .from(taskReminders)
    .innerJoin(tasks, eq(taskReminders.taskId, tasks.id))
    .innerJoin(
      reminderEndpoints,
      eq(taskReminders.endpointId, reminderEndpoints.id),
    )
    .where(and(eq(taskReminders.enabled, 1), eq(reminderEndpoints.enabled, 1)))
    .all();

  const now = new Date(input.nowIso).getTime();
  const enqueued: ReminderDelivery[] = [];

  for (const row of joined) {
    if (row.task.status === "done" || row.task.status === "cancelled") {
      suppressPendingReminderDeliveriesForTask(db, row.task.id);
      continue;
    }

    const sendAt = resolveReminderSendTime({
      task: row.task as Pick<
        Task,
        "due" | "startAt" | "allDay" | "timezone" | "status"
      >,
      anchor: row.reminder.anchor,
      offsetMinutes: row.reminder.offsetMinutes,
      allDayLocalTime: row.reminder.allDayLocalTime,
      defaultAllDayLocalTime: "09:00",
      userTimezone: input.userTimezoneResolver(row.reminder.userId),
    });

    if (!sendAt || sendAt.getTime() > now) continue;

    enqueued.push(
      enqueueReminderDelivery(db, {
        userId: row.reminder.userId,
        taskId: row.task.id,
        taskReminderId: row.reminder.id,
        endpointId: row.endpoint.id,
        adapterKey: row.endpoint.adapterKey,
        scheduledFor: sendAt.toISOString(),
      }),
    );
  }

  return enqueued;
}
