import type { TaskStatus } from "./types";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  wip: "In Progress",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

export const ACTIVE_TASK_STATUSES: TaskStatus[] = ["pending", "wip", "blocked"];

export type TaskStatusColumn = {
  status: TaskStatus;
  label: string;
};

export const KANBAN_COLUMNS: TaskStatusColumn[] = [
  { status: "pending", label: "Waiting" },
  { status: "wip", label: TASK_STATUS_LABELS.wip },
  { status: "blocked", label: TASK_STATUS_LABELS.blocked },
  { status: "done", label: TASK_STATUS_LABELS.done },
];
