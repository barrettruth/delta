"use client";

import { Inbox } from "lucide-react";
import { useState } from "react";
import { completeTaskAction, updateTaskAction } from "@/app/actions/tasks";
import { StatusBadge } from "@/components/status-badge";
import { TaskDetail } from "@/components/task-detail";
import type { Task, TaskStatus } from "@/core/types";

const columns: { status: TaskStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "wip", label: "In Progress" },
  { status: "blocked", label: "Blocked" },
  { status: "done", label: "Done" },
];

function groupByStatus(tasks: Task[]): Record<string, Task[]> {
  const grouped: Record<string, Task[]> = {};
  for (const task of tasks) {
    const key = task.status;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(task);
  }
  return grouped;
}

export function KanbanBoard({ tasks }: { tasks: Task[] }) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const grouped = groupByStatus(tasks);

  async function handleDrop(taskId: number, newStatus: TaskStatus) {
    if (newStatus === "done") {
      await completeTaskAction(taskId);
    } else {
      await updateTaskAction(taskId, { status: newStatus });
    }
  }

  return (
    <div className="grid grid-cols-4 gap-4 p-4 h-full w-full">
      {columns.map((col) => {
        const colTasks = grouped[col.status] ?? [];
        return (
          <section
            key={col.status}
            className={`flex flex-col min-w-0 rounded-lg border transition-colors ${
              dragOver === col.status
                ? "border-primary/50 bg-primary/5"
                : "border-border/60 bg-muted/30"
            }`}
            aria-label={`${col.label} column`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(col.status);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              const id = Number(e.dataTransfer.getData("text/plain"));
              if (id) handleDrop(id, col.status);
              setDragId(null);
              setDragOver(null);
            }}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <StatusBadge status={col.status} />
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {colTasks.length}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {colTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Inbox className="size-5 opacity-30" />
                  <p className="text-xs">No tasks</p>
                </div>
              ) : (
                colTasks.map((task) => (
                  <article
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", String(task.id));
                      setDragId(task.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOver(null);
                    }}
                    className={`rounded-md border border-border/60 bg-card p-3 cursor-grab active:cursor-grabbing transition-all hover:border-border hover:shadow-sm ${
                      dragId === task.id ? "opacity-40 scale-95" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
                      onClick={() => setSelectedTask(task)}
                    >
                      <p className="text-sm font-medium leading-snug">
                        {task.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {task.priority !== null && task.priority > 0 && (
                          <span className="text-xs font-semibold text-primary">
                            {"!".repeat(Math.min(task.priority, 3))}
                          </span>
                        )}
                        {task.category && task.category !== "Todo" && (
                          <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50">
                            {task.category}
                          </span>
                        )}
                        {task.due && (
                          <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                            {new Date(task.due).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>
        );
      })}
      <TaskDetail
        task={selectedTask}
        open={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}
