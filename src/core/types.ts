import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "@/db/schema";

export type Db = BetterSQLite3Database<typeof schema>;

export type Task = typeof schema.tasks.$inferSelect;
export type NewTask = typeof schema.tasks.$inferInsert;

export const TASK_STATUSES = [
  "pending",
  "done",
  "wip",
  "blocked",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const RECUR_MODES = ["scheduled", "completion"] as const;
export type RecurMode = (typeof RECUR_MODES)[number];

export interface CreateTaskInput {
  description: string;
  status?: TaskStatus;
  category?: string;
  priority?: number;
  due?: string;
  recurrence?: string;
  recurMode?: RecurMode;
  notes?: string;
  order?: number;
}

export interface UpdateTaskInput {
  description?: string;
  status?: TaskStatus;
  category?: string | null;
  priority?: number;
  due?: string | null;
  recurrence?: string | null;
  recurMode?: RecurMode | null;
  notes?: string | null;
  order?: number;
}

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[];
  category?: string;
  dueBefore?: string;
  dueAfter?: string;
  minPriority?: number;
  sortBy?: "priority" | "due" | "createdAt" | "order";
  sortOrder?: "asc" | "desc";
}
