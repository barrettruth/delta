"use client";

import { Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  completeTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { TaskDetail } from "@/components/task-detail";
import type { TaskStatus } from "@/core/types";

import type { RankedTask } from "@/core/urgency";
import { useKeyboard } from "@/hooks/use-keyboard";
import { formatDate } from "@/lib/utils";

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "todo",
  wip: "wip",
  done: "done",
  blocked: "blocked",
  cancelled: "cancelled",
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  pending: "text-status-pending",
  wip: "text-status-wip",
  done: "text-status-done",
  blocked: "text-status-blocked",
  cancelled: "text-status-cancelled",
};

function nextStatus(current: TaskStatus): TaskStatus {
  const order: TaskStatus[] = [
    "pending",
    "wip",
    "blocked",
    "done",
    "cancelled",
  ];
  const idx = order.indexOf(current);
  return order[(idx + 1) % order.length];
}

export function QueueView({
  tasks,
  categories,
  defaultCategory,
}: {
  tasks: RankedTask[];
  categories?: string[];
  defaultCategory?: string;
}) {
  const [selectedTask, setSelectedTask] = useState<RankedTask | null>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  const { cursor, setCursor, selectedIds, toggleSelect, pendingDelete } =
    useKeyboard({
      tasks,
      onComplete: (ids) => {
        for (const id of ids) completeTaskAction(id);
      },
      onDelete: (ids) => {
        for (const id of ids) deleteTaskAction(id);
        if (selectedTask && ids.includes(selectedTask.id))
          setSelectedTask(null);
      },
      onSelect: (task) => setSelectedTask(task as RankedTask),
      onDeselect: () => setSelectedTask(null),
      onHelp: () => window.dispatchEvent(new Event("open-keymap-help")),
      scrollRef,
    });

  useEffect(() => {
    if (cursor >= 0 && cursor < tasks.length) {
      const el = rowRefs.current.get(tasks[cursor].id);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [cursor, tasks]);

  function handleRowClick(task: RankedTask, idx: number, e: React.MouseEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      toggleSelect(task.id);
      return;
    }
    setCursor(idx);
    setSelectedTask(task);
  }

  return (
    <div className="flex flex-col h-full">
      {pendingDelete && (
        <div className="flex items-center gap-2 px-6 py-1.5 bg-destructive/10 text-xs text-destructive border-b border-destructive/20">
          <span>
            delete {pendingDelete.length} task
            {pendingDelete.length > 1 ? "s" : ""}? y/N
          </span>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16">
            <Zap className="size-10 opacity-40" />
            <p className="text-sm">Nothing urgent</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {tasks.map((task, i) => {
              const isCursor = i === cursor;
              const isSelected = selectedIds.has(task.id);

              let bg = "hover:bg-accent/50";
              if (isSelected) bg = "bg-primary/10";
              else if (isCursor) bg = "bg-accent";

              return (
                <div
                  key={task.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(task.id, el);
                  }}
                  className={`flex w-full items-center gap-3 px-6 py-2.5 cursor-pointer transition-colors text-left select-none ${bg}`}
                  onClick={(e) => handleRowClick(task, i, e)}
                  onKeyDown={() => {}}
                  tabIndex={0}
                  role="row"
                >
                  <button
                    type="button"
                    className={`w-16 text-xs shrink-0 text-left hover:underline ${STATUS_COLOR[task.status as TaskStatus]}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = nextStatus(task.status as TaskStatus);
                      if (next === "done") {
                        completeTaskAction(task.id);
                      } else {
                        updateTaskAction(task.id, { status: next });
                      }
                    }}
                  >
                    {STATUS_LABEL[task.status as TaskStatus]}
                  </button>
                  <span
                    className={`flex-1 truncate text-sm ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}
                  >
                    {task.description}
                  </span>
                  {task.category && (
                    <span className="w-24 truncate text-xs text-muted-foreground text-right shrink-0">
                      # {task.category}
                    </span>
                  )}
                  {task.due && (
                    <span className="w-20 text-xs text-muted-foreground text-right tabular-nums shrink-0">
                      {formatDate(new Date(task.due))}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <TaskDetail
        task={selectedTask}
        open={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
        tasks={tasks}
        onSelectTask={(t) => setSelectedTask(t as RankedTask)}
      />
    </div>
  );
}
