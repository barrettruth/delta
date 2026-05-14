"use client";

import { MapPinSimple, VideoCamera } from "@phosphor-icons/react";
import { TaskSourceIndicator } from "@/components/task-source-indicator";
import type { Task, TaskStatus } from "@/core/types";
import { formatDate } from "@/lib/utils";

interface KanbanCardProps {
  dragId: number | null;
  isCursor: boolean;
  isSelected: boolean;
  onOpenTask: (taskId: number) => void;
  setDragId: (taskId: number | null) => void;
  setDragOver: (status: TaskStatus | null) => void;
  task: Task;
}

export function KanbanCard({
  dragId,
  isCursor,
  isSelected,
  onOpenTask,
  setDragId,
  setDragOver,
  task,
}: KanbanCardProps) {
  let bg = "hover:bg-accent/50";
  if (isSelected) bg = "bg-primary/10";
  else if (isCursor) bg = "bg-accent";

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(task.id));
        setDragId(task.id);
      }}
      onDragEnd={() => {
        setDragId(null);
        setDragOver(null);
      }}
      className={`border-b border-border/40 p-3 cursor-grab active:cursor-grabbing transition-colors min-h-[44px] ${bg} ${
        dragId === task.id ? "opacity-40" : ""
      }`}
    >
      <button
        type="button"
        className="w-full text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        onClick={() => onOpenTask(task.id)}
      >
        <p className="text-sm font-medium leading-snug">{task.description}</p>
        <div className="flex items-center gap-2 mt-2">
          <TaskSourceIndicator source={task.sourceInfo} />
          {task.category && task.category !== "Todo" && (
            <span className="text-xs text-muted-foreground">
              # {task.category}
            </span>
          )}
          {task.location && (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground truncate max-w-[16ch]">
              <MapPinSimple className="w-3 h-3 shrink-0" />
              {task.location}
            </span>
          )}
          {task.meetingUrl && (
            <VideoCamera className="w-3 h-3 shrink-0 text-muted-foreground" />
          )}
          {task.due && (
            <span className="text-xs text-muted-foreground ml-auto tabular-nums">
              {formatDate(new Date(task.due))}
            </span>
          )}
        </div>
      </button>
    </article>
  );
}
