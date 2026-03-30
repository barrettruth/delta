import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "@/db/schema";

export type Db = BetterSQLite3Database<typeof schema>;

export type Task = typeof schema.tasks.$inferSelect;

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
  due?: string;
  startAt?: string;
  endAt?: string;
  allDay?: number;
  timezone?: string;
  recurrence?: string;
  recurMode?: RecurMode;
  notes?: string;
  order?: number;
  location?: string;
  locationLat?: number;
  locationLon?: number;
  meetingUrl?: string;
  exdates?: string;
  rdates?: string;
  recurringTaskId?: number;
  originalStartAt?: string;
  externalId?: string;
  externalSource?: string;
}

export interface UpdateTaskInput {
  description?: string;
  status?: TaskStatus;
  category?: string | null;
  due?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  allDay?: number | null;
  timezone?: string | null;
  recurrence?: string | null;
  recurMode?: RecurMode | null;
  notes?: string | null;
  order?: number;
  location?: string | null;
  locationLat?: number | null;
  locationLon?: number | null;
  meetingUrl?: string | null;
  exdates?: string | null;
  rdates?: string | null;
  externalId?: string | null;
  externalSource?: string | null;
}

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[];
  category?: string;
  dueBefore?: string;
  dueAfter?: string;
  sortBy?: "due" | "createdAt" | "order";
  sortOrder?: "asc" | "desc";
}

export type ConflictResolution = "lww" | "google_wins" | "delta_wins";

export type NlpSource = "local" | "anthropic" | "openai";
export type NlpProvider = "anthropic" | "openai";
