"use client";

import { Inbox } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { completeTaskAction, updateTaskAction } from "@/app/actions/tasks";

import { TaskDetail } from "@/components/task-detail";
import type { Task, TaskStatus } from "@/core/types";
import { isInputFocused } from "@/lib/utils";

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
  const [colIdx, setColIdx] = useState(0);
  const [rowIdx, setRowIdx] = useState(0);
  const [kbActive, setKbActive] = useState(false);
  const grouped = groupByStatus(tasks);

  const getColTasks = useCallback(
    (ci: number) => grouped[columns[ci].status] ?? [],
    [grouped],
  );

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (selectedTask) return;

      switch (e.key) {
        case "h": {
          e.preventDefault();
          setKbActive(true);
          setColIdx((c) => Math.max(c - 1, 0));
          setRowIdx(0);
          break;
        }
        case "l": {
          e.preventDefault();
          setKbActive(true);
          setColIdx((c) => Math.min(c + 1, columns.length - 1));
          setRowIdx(0);
          break;
        }
        case "j": {
          e.preventDefault();
          setKbActive(true);
          setRowIdx((r) => {
            const colTasks = getColTasks(colIdx);
            return Math.min(r + 1, colTasks.length - 1);
          });
          break;
        }
        case "k": {
          e.preventDefault();
          setKbActive(true);
          setRowIdx((r) => Math.max(r - 1, 0));
          break;
        }
        case "H": {
          e.preventDefault();
          const colTasks = getColTasks(colIdx);
          if (colTasks.length === 0 || rowIdx >= colTasks.length) break;
          const task = colTasks[rowIdx];
          const newCol = Math.max(colIdx - 1, 0);
          if (newCol !== colIdx) {
            const newStatus = columns[newCol].status;
            if (newStatus === "done") {
              completeTaskAction(task.id);
            } else {
              updateTaskAction(task.id, { status: newStatus });
            }
            setColIdx(newCol);
          }
          break;
        }
        case "L": {
          e.preventDefault();
          const colTasks = getColTasks(colIdx);
          if (colTasks.length === 0 || rowIdx >= colTasks.length) break;
          const task = colTasks[rowIdx];
          const newCol = Math.min(colIdx + 1, columns.length - 1);
          if (newCol !== colIdx) {
            const newStatus = columns[newCol].status;
            if (newStatus === "done") {
              completeTaskAction(task.id);
            } else {
              updateTaskAction(task.id, { status: newStatus });
            }
            setColIdx(newCol);
          }
          break;
        }
        case "Enter": {
          const colTasks = getColTasks(colIdx);
          if (colTasks.length > 0 && rowIdx < colTasks.length) {
            e.preventDefault();
            setSelectedTask(colTasks[rowIdx]);
          }
          break;
        }
        case "Escape": {
          setKbActive(false);
          setColIdx(0);
          setRowIdx(0);
          break;
        }
      }
    },
    [colIdx, rowIdx, getColTasks, selectedTask],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);

  async function handleDrop(taskId: number, newStatus: TaskStatus) {
    if (newStatus === "done") {
      await completeTaskAction(taskId);
    } else {
      await updateTaskAction(taskId, { status: newStatus });
    }
  }

  return (
    <div className="grid grid-cols-4 gap-0 h-full w-full">
      {columns.map((col, ci) => {
        const colTasks = grouped[col.status] ?? [];
        const isActiveCol = kbActive && ci === colIdx;
        return (
          <section
            key={col.status}
            className={`flex flex-col min-w-0 border-r border-border/40 last:border-r-0 transition-colors ${
              dragOver === col.status
                ? "bg-primary/5"
                : isActiveCol
                  ? "bg-accent/30"
                  : ""
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
              <span className="text-xs font-medium">{col.label}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {colTasks.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {colTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Inbox className="size-5 opacity-30" />
                  <p className="text-xs">No tasks</p>
                </div>
              ) : (
                colTasks.map((task, ri) => {
                  const isCursor = isActiveCol && ri === rowIdx;
                  return (
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
                      className={`border-b border-border/40 p-3 cursor-grab active:cursor-grabbing transition-colors hover:bg-accent/50 ${
                        dragId === task.id ? "opacity-40" : ""
                      } ${isCursor ? "bg-accent" : ""}`}
                    >
                      <button
                        type="button"
                        className="w-full text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                            <span className="text-xs text-muted-foreground">
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
                  );
                })
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
