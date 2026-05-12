import type { TaskStatusColumn } from "@/core/task-status";
import type { TaskStatus } from "@/core/types";

export interface KanbanGroupedTask {
  id: number;
  status: TaskStatus;
}

export type KanbanTaskGroups<T extends KanbanGroupedTask = KanbanGroupedTask> =
  Partial<Record<TaskStatus, T[]>>;

export function kanbanTaskIdRangeSet<T extends { id: number }>(
  tasks: T[],
  a: number,
  b: number,
): Set<number> {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const ids = new Set<number>();
  for (let i = lo; i <= hi; i++) {
    if (i >= 0 && i < tasks.length) ids.add(tasks[i].id);
  }
  return ids;
}

export function groupKanbanTasksByStatus<T extends KanbanGroupedTask>(
  tasks: T[],
): KanbanTaskGroups<T> {
  const grouped: KanbanTaskGroups<T> = {};
  for (const task of tasks) {
    const statusTasks = grouped[task.status] ?? [];
    statusTasks.push(task);
    grouped[task.status] = statusTasks;
  }
  return grouped;
}

export function kanbanVisibleColumnIndices<T extends KanbanGroupedTask>(
  columns: TaskStatusColumn[],
  grouped: KanbanTaskGroups<T>,
): number[] {
  return columns
    .map((col, idx) => ({ idx, status: col.status }))
    .filter((col) => (grouped[col.status] ?? []).length > 0)
    .map((col) => col.idx);
}

export function kanbanVisibleColumns<T extends KanbanGroupedTask>(
  columns: TaskStatusColumn[],
  grouped: KanbanTaskGroups<T>,
): TaskStatusColumn[] {
  return columns.filter((col) => (grouped[col.status] ?? []).length > 0);
}

export function moveKanbanVisibleColumnIndex<T extends KanbanGroupedTask>({
  columns,
  currentIndex,
  delta,
  grouped,
}: {
  columns: TaskStatusColumn[];
  currentIndex: number;
  delta: number;
  grouped: KanbanTaskGroups<T>;
}): number {
  const visibleIndices = kanbanVisibleColumnIndices(columns, grouped);
  if (visibleIndices.length === 0) return currentIndex;

  const pos = visibleIndices.indexOf(currentIndex);
  if (pos === -1) return visibleIndices[0];

  const target = Math.max(0, Math.min(pos + delta, visibleIndices.length - 1));
  return visibleIndices[target];
}
