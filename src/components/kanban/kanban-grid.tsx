"use client";

import { memo } from "react";
import type { TaskStatusColumn } from "@/core/task-status";
import type { Task, TaskStatus } from "@/core/types";
import type { KanbanTaskGroups } from "@/lib/kanban-board";
import { KanbanColumn } from "./kanban-column";

interface KanbanGridProps {
  colIdx: number;
  columnHints: string[];
  columns: TaskStatusColumn[];
  dragId: number | null;
  dragOver: TaskStatus | null;
  grouped: KanbanTaskGroups<Task>;
  kbActive: boolean;
  onDropTask: (taskId: number, newStatus: TaskStatus) => void;
  onOpenTask: (taskId: number) => void;
  rowIdx: number;
  selectedIds: Set<number>;
  setDragId: (taskId: number | null) => void;
  setDragOver: (status: TaskStatus | null) => void;
  visibleColumns: TaskStatusColumn[];
}

export const KanbanGrid = memo(function KanbanGrid({
  colIdx,
  columnHints,
  columns,
  dragId,
  dragOver,
  grouped,
  kbActive,
  onDropTask,
  onOpenTask,
  rowIdx,
  selectedIds,
  setDragId,
  setDragOver,
  visibleColumns,
}: KanbanGridProps) {
  const gridCols =
    visibleColumns.length <= 1
      ? "grid-cols-1"
      : visibleColumns.length === 2
        ? "grid-cols-2"
        : visibleColumns.length === 3
          ? "grid-cols-3"
          : "grid-cols-4";

  if (visibleColumns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-0 text-muted-foreground">
        <span className="text-4xl font-light mb-2">&delta;</span>
        <span className="text-sm">no tasks on board</span>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-x-auto">
      <div
        className={`grid ${gridCols} gap-0 h-full`}
        style={{ minWidth: `${visibleColumns.length * 200}px` }}
      >
        {visibleColumns.map((col) => {
          const ci = columns.indexOf(col);
          return (
            <KanbanColumn
              key={col.status}
              column={col}
              columnHint={columnHints[ci]}
              dragId={dragId}
              dragOver={dragOver}
              isActiveColumn={kbActive && ci === colIdx}
              onDropTask={onDropTask}
              onOpenTask={onOpenTask}
              rowIdx={rowIdx}
              selectedIds={selectedIds}
              setDragId={setDragId}
              setDragOver={setDragOver}
              tasks={grouped[col.status] ?? []}
            />
          );
        })}
      </div>
    </div>
  );
});
