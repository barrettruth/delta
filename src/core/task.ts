import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { tasks } from "@/db/schema";
import { updateBlockedStatus } from "./dag";
import { getNextTaskData } from "./recurrence";
import { suppressPendingReminderDeliveriesForTask } from "./reminders/deliveries";
import { copyTaskReminders } from "./reminders/rules";
import type {
  CreateTaskInput,
  Db,
  Task,
  TaskFilters,
  UpdateTaskInput,
} from "./types";

function timestamp(): string {
  return new Date().toISOString();
}

export function createTask(
  db: Db,
  userId: number,
  input: CreateTaskInput,
): Task {
  const ts = timestamp();
  return db
    .insert(tasks)
    .values({
      userId,
      description: input.description,
      status: input.status ?? "pending",
      category: input.category ?? "Todo",
      startAt: input.startAt ?? null,
      endAt: input.endAt ?? null,
      allDay: input.allDay ?? 0,
      timezone: input.timezone ?? null,
      due: input.due ?? null,
      recurrence: input.recurrence ?? null,
      recurMode: input.recurMode ?? null,
      notes: input.notes ?? null,
      order: input.order ?? 0,
      location: input.location ?? null,
      locationLat: input.locationLat ?? null,
      locationLon: input.locationLon ?? null,
      meetingUrl: input.meetingUrl ?? null,
      exdates: input.exdates ?? null,
      rdates: input.rdates ?? null,
      recurringTaskId: input.recurringTaskId ?? null,
      originalStartAt: input.originalStartAt ?? null,
      externalId: input.externalId ?? null,
      externalSource: input.externalSource ?? null,
      createdAt: ts,
      updatedAt: ts,
    })
    .returning()
    .get();
}

export function getTask(db: Db, id: number): Task | undefined {
  return db.select().from(tasks).where(eq(tasks.id, id)).get();
}

function getSortColumn(sortBy: string | undefined) {
  switch (sortBy) {
    case "due":
      return tasks.due;
    case "order":
      return tasks.order;
    default:
      return tasks.createdAt;
  }
}

export function listTasks(
  db: Db,
  userId: number,
  filters?: TaskFilters,
): Task[] {
  const conditions = [eq(tasks.userId, userId)];

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      conditions.push(inArray(tasks.status, filters.status));
    } else {
      conditions.push(eq(tasks.status, filters.status));
    }
  }

  if (filters?.category) {
    conditions.push(eq(tasks.category, filters.category));
  }

  if (filters?.dueBefore) {
    conditions.push(lte(tasks.due, filters.dueBefore));
  }

  if (filters?.dueAfter) {
    conditions.push(gte(tasks.due, filters.dueAfter));
  }

  const where = and(...conditions);
  const sortColumn = getSortColumn(filters?.sortBy);
  const sortFn = filters?.sortOrder === "asc" ? asc : desc;

  return db.select().from(tasks).where(where).orderBy(sortFn(sortColumn)).all();
}

export function listExceptions(db: Db, masterId: number): Task[] {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.recurringTaskId, masterId))
    .all();
}

export function updateTask(db: Db, id: number, input: UpdateTaskInput): Task {
  const existing = getTask(db, id);
  if (!existing) throw new Error(`Task ${id} not found`);

  const isCompleting =
    (input.status === "done" || input.status === "cancelled") &&
    existing.status !== input.status;
  const isReopening =
    input.status !== undefined &&
    input.status !== "done" &&
    input.status !== "cancelled" &&
    (existing.status === "done" || existing.status === "cancelled");

  const task = db
    .update(tasks)
    .set({
      ...input,
      updatedAt: timestamp(),
      ...(isCompleting ? { completedAt: timestamp() } : {}),
      ...(isReopening ? { completedAt: null } : {}),
    })
    .where(eq(tasks.id, id))
    .returning()
    .get();

  if (isCompleting) {
    suppressPendingReminderDeliveriesForTask(db, id);
  }

  return task;
}

export function completeTask(
  db: Db,
  userId: number,
  id: number,
): { task: Task; spawnedTaskId: number | null } {
  const task = updateTask(db, id, { status: "done" });

  let spawnedTaskId: number | null = null;
  if (!task.recurringTaskId) {
    const nextData = getNextTaskData(task);
    if (nextData) {
      const spawned = createTask(db, userId, nextData);
      copyTaskReminders(db, userId, task.id, spawned.id);
      spawnedTaskId = spawned.id;
    }
  }

  updateBlockedStatus(db, id);

  return { task, spawnedTaskId };
}

export function deleteTask(db: Db, id: number): Task {
  const task = updateTask(db, id, { status: "cancelled" });
  updateBlockedStatus(db, id);
  return task;
}
