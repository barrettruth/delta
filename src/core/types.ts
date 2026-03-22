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
