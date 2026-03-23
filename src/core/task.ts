import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { tasks } from "@/db/schema";
import { updateBlockedStatus } from "./dag";
import { getNextTaskData } from "./recurrence";
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
      priority: input.priority ?? 0,
      due: input.due ?? null,
      recurrence: input.recurrence ?? null,
      recurMode: input.recurMode ?? null,
      notes: input.notes ?? null,
      order: input.order ?? 0,
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
    case "priority":
      return tasks.priority;
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

  if (filters?.minPriority !== undefined) {
    conditions.push(gte(tasks.priority, filters.minPriority));
  }

  const where = and(...conditions);
  const sortColumn = getSortColumn(filters?.sortBy);
  const sortFn = filters?.sortOrder === "asc" ? asc : desc;

  return db.select().from(tasks).where(where).orderBy(sortFn(sortColumn)).all();
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

  return db
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
}

export function completeTask(db: Db, userId: number, id: number): Task {
  const task = updateTask(db, id, { status: "done" });

  const nextData = getNextTaskData(task);
  if (nextData) createTask(db, userId, nextData);

  updateBlockedStatus(db, id);

  return task;
}

export function deleteTask(db: Db, id: number): Task {
  const task = updateTask(db, id, { status: "cancelled" });
  updateBlockedStatus(db, id);
  return task;
}
