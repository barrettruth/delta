import type { TaskStatus } from "./types";

export type UndoOperationType = "delete" | "complete" | "status-change";

export interface UndoMutation {
  taskId: number;
  restore: {
    status: TaskStatus;
    completedAt: string | null;
  };
  spawnedTaskId?: number;
}

export interface UndoEntry {
  op: UndoOperationType;
  label: string;
  mutations: UndoMutation[];
  timestamp: number;
}
