"use client";

import type { TaskStatusColumn } from "@/core/task-status";
import type { Task, TaskStatus } from "@/core/types";
import { KanbanCard } from "./kanban-card";

interface KanbanColumnProps {
  column: TaskStatusColumn;
  columnHint: string;
  dragId: number | null;
  dragOver: TaskStatus | null;
  isActiveColumn: boolean;
  onDropTask: (taskId: number, newStatus: TaskStatus) => void;
  onOpenTask: (taskId: number) => void;
  rowIdx: number;
  selectedIds: Set<number>;
  setDragId: (taskId: number | null) => void;
  setDragOver: (status: TaskStatus | null) => void;
  tasks: Task[];
}

export function KanbanColumn({
  column,
  columnHint,
  dragId,
  dragOver,
  isActiveColumn,
  onDropTask,
  onOpenTask,
  rowIdx,
  selectedIds,
  setDragId,
  setDragOver,
  tasks,
}: KanbanColumnProps) {
  return (
    <section
      className={`flex flex-col min-w-0 border-r border-border/40 last:border-r-0 transition-colors ${
        dragOver === column.status
          ? "bg-primary/5"
          : isActiveColumn
            ? "bg-accent/30"
            : ""
      }`}
      aria-label={`${column.label} column`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(column.status);
      }}
      onDragLeave={() => setDragOver(null)}
      onDrop={(e) => {
        e.preventDefault();
        const id = Number(e.dataTransfer.getData("text/plain"));
        if (id) onDropTask(id, column.status);
        setDragId(null);
        setDragOver(null);
      }}
    >
      <div className="flex items-center justify-between h-8 px-3 border-b border-border/60">
        <span className="text-xs font-medium">{column.label}</span>
        <kbd className="text-[10px] text-muted-foreground">{columnHint}</kbd>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tasks.map((task, ri) => (
          <KanbanCard
            key={task.id}
            dragId={dragId}
            isCursor={isActiveColumn && ri === rowIdx}
            isSelected={selectedIds.has(task.id)}
            onOpenTask={onOpenTask}
            setDragId={setDragId}
            setDragOver={setDragOver}
            task={task}
          />
        ))}
      </div>
    </section>
  );
}
