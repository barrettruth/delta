import { and, eq } from "drizzle-orm";
import { taskReminders } from "@/db/schema";
import type { Db } from "../types";
import type { ReminderAnchor, TaskReminder } from "./types";

export interface CreateTaskReminderInput {
  taskId: number;
  endpointId: number;
  anchor: ReminderAnchor;
  offsetMinutes: number;
  allDayLocalTime?: string | null;
  enabled?: number;
}

export interface UpdateTaskReminderInput {
  endpointId?: number;
  anchor?: ReminderAnchor;
  offsetMinutes?: number;
  allDayLocalTime?: string | null;
  enabled?: number;
}

function timestamp(): string {
  return new Date().toISOString();
}

export function createTaskReminder(
  db: Db,
  userId: number,
  input: CreateTaskReminderInput,
): TaskReminder {
  const now = timestamp();

  return db
    .insert(taskReminders)
    .values({
      userId,
      taskId: input.taskId,
      endpointId: input.endpointId,
      anchor: input.anchor,
      offsetMinutes: input.offsetMinutes,
      allDayLocalTime: input.allDayLocalTime ?? null,
      enabled: input.enabled ?? 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
}

export function getTaskReminder(
  db: Db,
  userId: number,
  id: number,
): TaskReminder | null {
  const row = db
    .select()
    .from(taskReminders)
    .where(and(eq(taskReminders.userId, userId), eq(taskReminders.id, id)))
    .get();

  return row ?? null;
}

export function listTaskReminders(
  db: Db,
  userId: number,
  taskId: number,
): TaskReminder[] {
  return db
    .select()
    .from(taskReminders)
    .where(
      and(eq(taskReminders.userId, userId), eq(taskReminders.taskId, taskId)),
    )
    .all();
}

export function updateTaskReminder(
  db: Db,
  userId: number,
  id: number,
  input: UpdateTaskReminderInput,
): TaskReminder | null {
  const existing = getTaskReminder(db, userId, id);
  if (!existing) return null;

  return db
    .update(taskReminders)
    .set({
      endpointId: input.endpointId ?? existing.endpointId,
      anchor: input.anchor ?? existing.anchor,
      offsetMinutes: input.offsetMinutes ?? existing.offsetMinutes,
      allDayLocalTime:
        input.allDayLocalTime === undefined
          ? existing.allDayLocalTime
          : input.allDayLocalTime,
      enabled: input.enabled ?? existing.enabled,
      updatedAt: timestamp(),
    })
    .where(eq(taskReminders.id, existing.id))
    .returning()
    .get();
}

export function deleteTaskReminder(
  db: Db,
  userId: number,
  id: number,
): boolean {
  const result = db
    .delete(taskReminders)
    .where(and(eq(taskReminders.userId, userId), eq(taskReminders.id, id)))
    .run();

  return result.changes > 0;
}

export function copyTaskReminders(
  db: Db,
  userId: number,
  fromTaskId: number,
  toTaskId: number,
): TaskReminder[] {
  const source = listTaskReminders(db, userId, fromTaskId);

  return source.map((reminder) =>
    createTaskReminder(db, userId, {
      taskId: toTaskId,
      endpointId: reminder.endpointId,
      anchor: reminder.anchor,
      offsetMinutes: reminder.offsetMinutes,
      allDayLocalTime: reminder.allDayLocalTime,
      enabled: reminder.enabled,
    }),
  );
}
