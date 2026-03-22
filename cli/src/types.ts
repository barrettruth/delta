export const TASK_STATUSES = [
  "pending",
  "done",
  "wip",
  "blocked",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task {
  id: number;
  description: string;
  status: TaskStatus;
  category: string | null;
  priority: number | null;
  due: string | null;
  recurrence: string | null;
  recurMode: string | null;
  notes: string | null;
  order: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CreateTaskInput {
  description: string;
  status?: TaskStatus;
  category?: string;
  priority?: number;
  due?: string;
}

export interface UpdateTaskInput {
  description?: string;
  status?: TaskStatus;
  category?: string | null;
  priority?: number;
  due?: string | null;
}

export interface TaskFilters {
  status?: string;
  category?: string;
}

export interface User {
  id: number;
  username: string;
  createdAt: string;
}
