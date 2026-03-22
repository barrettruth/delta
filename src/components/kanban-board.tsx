"use client";

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
  const grouped = groupByStatus(tasks);

  async function handleDrop(taskId: number, newStatus: TaskStatus) {
    if (newStatus === "done") {
      await completeTaskAction(taskId);
    } else {
      await updateTaskAction(taskId, { status: newStatus });
    }
  }

  return (
    <div className="flex gap-4 p-4 h-full overflow-x-auto">
      {columns.map((col) => {
        const colTasks = grouped[col.status] ?? [];
        return (
          <section
            key={col.status}
            className="flex flex-col w-72 shrink-0 rounded-lg bg-muted/50"
            aria-label={`${col.label} column`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = Number(e.dataTransfer.getData("text/plain"));
              if (id) handleDrop(id, col.status);
              setDragId(null);
            }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="flex items-center gap-2">
                <StatusBadge status={col.status} />
                <span className="text-xs text-muted-foreground">
                  {colTasks.length}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {colTasks.map((task) => (
                <article
                  key={task.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", String(task.id));
                    setDragId(task.id);
                  }}
                  onDragEnd={() => setDragId(null)}
                  className={`rounded-md border bg-card p-3 cursor-grab active:cursor-grabbing transition-opacity ${
                    dragId === task.id ? "opacity-50" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => setSelectedTask(task)}
                  >
                    <p className="text-sm font-medium leading-tight">
                      {task.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {task.priority !== null && task.priority > 0 && (
                        <span className="text-xs font-medium text-primary">
                          {"!".repeat(Math.min(task.priority, 3))}
                        </span>
                      )}
                      {task.category && task.category !== "Todo" && (
                        <span className="text-xs text-muted-foreground">
                          {task.category}
                        </span>
                      )}
                      {task.due && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(task.due).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </button>
                </article>
              ))}
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
