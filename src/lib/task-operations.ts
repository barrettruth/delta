import type { Task, TaskStatus } from "@/core/types";
import type { UndoEntry, UndoMutation, UndoOperationType } from "@/core/undo";

const OP_ID_PREFIX: Record<UndoOperationType, string> = {
  complete: "complete",
  delete: "delete",
  "status-change": "status",
};

type UndoTaskSnapshot = Pick<Task, "id" | "status" | "completedAt">;

export function buildTaskMap<T extends UndoTaskSnapshot>(
  tasks: T[],
): Map<number, T> {
  return new Map(tasks.map((task) => [task.id, task]));
}

export function buildUndoMutation(
  taskId: number,
  task: UndoTaskSnapshot | undefined,
): UndoMutation {
  return {
    taskId,
    restore: {
      status: (task?.status as TaskStatus) ?? "pending",
      completedAt: task?.completedAt ?? null,
    },
  };
}

export function getTaskOperationLabel(
  op: UndoOperationType,
  count: number,
  status?: TaskStatus,
): string {
  const noun = count === 1 ? "task" : "tasks";
  if (op === "complete") return `${count} ${noun} completed`;
  if (op === "delete") return `${count} ${noun} deleted`;
  return `${count} ${noun} \u2192 ${status ?? "pending"}`;
}

export function buildTaskUndoEntry({
  op,
  taskIds,
  tasks,
  status,
  timestamp = Date.now(),
}: {
  op: UndoOperationType;
  taskIds: number[];
  tasks: ReadonlyMap<number, UndoTaskSnapshot>;
  status?: TaskStatus;
  timestamp?: number;
}): UndoEntry {
  return {
    id: `${OP_ID_PREFIX[op]}-${timestamp}-${taskIds.join(",")}`,
    op,
    label: getTaskOperationLabel(op, taskIds.length, status),
    mutations: taskIds.map((id) => buildUndoMutation(id, tasks.get(id))),
    timestamp,
  };
}

export function shouldPromptForRecurringDelete(
  task: Pick<Task, "recurrence" | "recurringTaskId"> | null | undefined,
): boolean {
  return Boolean(task?.recurrence || task?.recurringTaskId);
}
