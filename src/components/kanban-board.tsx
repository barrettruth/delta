"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  completeTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";

import { TaskDetail } from "@/components/task-detail";
import { Input } from "@/components/ui/input";
import type { Task, TaskStatus } from "@/core/types";
import { formatDate, isInputFocused } from "@/lib/utils";

const defaultColumns: { status: TaskStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "wip", label: "In Progress" },
  { status: "blocked", label: "Blocked" },
  { status: "done", label: "Done" },
];

function rangeSet(tasks: Task[], a: number, b: number): Set<number> {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const ids = new Set<number>();
  for (let i = lo; i <= hi; i++) {
    if (i >= 0 && i < tasks.length) ids.add(tasks[i].id);
  }
  return ids;
}

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
  const [columns, setColumns] = useState(defaultColumns);
  const [visualMode, setVisualMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const visualAnchor = useRef(-1);

  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q),
    );
  }, [tasks, searchQuery]);

  const grouped = useMemo(() => groupByStatus(filteredTasks), [filteredTasks]);

  const getColTasks = useCallback(
    (ci: number) => grouped[columns[ci].status] ?? [],
    [grouped, columns],
  );

  useEffect(() => {
    if (!visualMode) return;
    const colTasks = grouped[columns[colIdx].status] ?? [];
    setSelectedIds(rangeSet(colTasks, visualAnchor.current, rowIdx));
  }, [rowIdx, colIdx, visualMode, grouped, columns]);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (selectedTask) return;

      switch (e.key) {
        case "h": {
          e.preventDefault();
          if (visualMode) break;
          setKbActive(true);
          setColIdx((c) => Math.max(c - 1, 0));
          setRowIdx(0);
          break;
        }
        case "l": {
          e.preventDefault();
          if (visualMode) break;
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
          const newColH = Math.max(colIdx - 1, 0);
          if (newColH === colIdx) break;
          if (visualMode) {
            const colTasks = getColTasks(colIdx);
            const ids =
              selectedIds.size > 0
                ? [...selectedIds]
                : colTasks.length > 0 && rowIdx < colTasks.length
                  ? [colTasks[rowIdx].id]
                  : [];
            const newStatus = columns[newColH].status;
            for (const id of ids) {
              if (newStatus === "done") completeTaskAction(id);
              else updateTaskAction(id, { status: newStatus });
            }
            setSelectedIds(new Set());
            setVisualMode(false);
          } else {
            const colTasksH = getColTasks(colIdx);
            if (colTasksH.length === 0 || rowIdx >= colTasksH.length) break;
            const taskH = colTasksH[rowIdx];
            const newStatus = columns[newColH].status;
            if (newStatus === "done") completeTaskAction(taskH.id);
            else updateTaskAction(taskH.id, { status: newStatus });
          }
          setColIdx(newColH);
          setRowIdx(0);
          break;
        }
        case "L": {
          e.preventDefault();
          const newColL = Math.min(colIdx + 1, columns.length - 1);
          if (newColL === colIdx) break;
          if (visualMode) {
            const colTasks = getColTasks(colIdx);
            const ids =
              selectedIds.size > 0
                ? [...selectedIds]
                : colTasks.length > 0 && rowIdx < colTasks.length
                  ? [colTasks[rowIdx].id]
                  : [];
            const newStatus = columns[newColL].status;
            for (const id of ids) {
              if (newStatus === "done") completeTaskAction(id);
              else updateTaskAction(id, { status: newStatus });
            }
            setSelectedIds(new Set());
            setVisualMode(false);
          } else {
            const colTasksL = getColTasks(colIdx);
            if (colTasksL.length === 0 || rowIdx >= colTasksL.length) break;
            const taskL = colTasksL[rowIdx];
            const newStatus = columns[newColL].status;
            if (newStatus === "done") completeTaskAction(taskL.id);
            else updateTaskAction(taskL.id, { status: newStatus });
          }
          setColIdx(newColL);
          setRowIdx(0);
          break;
        }
        case "<": {
          e.preventDefault();
          if (visualMode) break;
          if (colIdx <= 0) break;
          setColumns((prev) => {
            const next = [...prev];
            [next[colIdx - 1], next[colIdx]] = [next[colIdx], next[colIdx - 1]];
            return next;
          });
          setColIdx((c) => c - 1);
          break;
        }
        case ">": {
          e.preventDefault();
          if (visualMode) break;
          if (colIdx >= columns.length - 1) break;
          setColumns((prev) => {
            const next = [...prev];
            [next[colIdx], next[colIdx + 1]] = [next[colIdx + 1], next[colIdx]];
            return next;
          });
          setColIdx((c) => c + 1);
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
        case "1":
        case "2":
        case "3":
        case "4": {
          e.preventDefault();
          const ci = Number(e.key) - 1;
          if (ci < columns.length) {
            setKbActive(true);
            setColIdx(ci);
            setRowIdx(0);
          }
          break;
        }
        case "V": {
          e.preventDefault();
          if (visualMode) {
            setVisualMode(false);
            setSelectedIds(new Set());
          } else if (kbActive) {
            const colTasks = getColTasks(colIdx);
            if (colTasks.length > 0 && rowIdx < colTasks.length) {
              setVisualMode(true);
              visualAnchor.current = rowIdx;
              setSelectedIds(new Set([colTasks[rowIdx].id]));
            }
          }
          break;
        }
        case "x": {
          e.preventDefault();
          if (selectedIds.size > 0) {
            for (const id of selectedIds) completeTaskAction(id);
            setSelectedIds(new Set());
            setVisualMode(false);
          } else if (kbActive) {
            const colTasks = getColTasks(colIdx);
            if (colTasks.length > 0 && rowIdx < colTasks.length) {
              completeTaskAction(colTasks[rowIdx].id);
            }
          }
          break;
        }
        case "d": {
          e.preventDefault();
          if (selectedIds.size > 0) {
            for (const id of selectedIds) deleteTaskAction(id);
            setSelectedIds(new Set());
            setVisualMode(false);
          } else if (kbActive) {
            const colTasks = getColTasks(colIdx);
            if (colTasks.length > 0 && rowIdx < colTasks.length) {
              deleteTaskAction(colTasks[rowIdx].id);
            }
          }
          break;
        }
        case "/": {
          e.preventDefault();
          setSearchActive(true);
          requestAnimationFrame(() => searchRef.current?.focus());
          break;
        }
        case "Escape": {
          if (searchActive) {
            setSearchQuery("");
            setSearchActive(false);
          } else if (visualMode) {
            setVisualMode(false);
            setSelectedIds(new Set());
          } else {
            setKbActive(false);
            setColIdx(0);
            setRowIdx(0);
          }
          break;
        }
      }
    },
    [
      colIdx,
      rowIdx,
      getColTasks,
      selectedTask,
      columns,
      kbActive,
      visualMode,
      selectedIds,
      searchActive,
    ],
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

  const visibleColumns = columns.filter(
    (col) => (grouped[col.status] ?? []).length > 0,
  );
  const gridCols =
    visibleColumns.length <= 1
      ? "grid-cols-1"
      : visibleColumns.length === 2
        ? "grid-cols-2"
        : visibleColumns.length === 3
          ? "grid-cols-3"
          : "grid-cols-4";

  return (
    <div className="flex flex-col h-full w-full">
      {searchActive && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border/60 shrink-0">
          <span className="text-xs text-muted-foreground">/</span>
          <Input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                setSearchQuery("");
                setSearchActive(false);
              }
              if (e.key === "Enter") {
                e.preventDefault();
                searchRef.current?.blur();
              }
            }}
            placeholder="filter tasks..."
            className="h-6 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
          />
          <span className="text-[10px] text-muted-foreground shrink-0">
            {filteredTasks.length}/{tasks.length}
          </span>
        </div>
      )}
      <div className={`grid ${gridCols} gap-0 flex-1 min-h-0`}>
        {visibleColumns.map((col) => {
          const ci = columns.indexOf(col);
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
                <span className="text-[10px] text-muted-foreground/40 font-mono tabular-nums">
                  {ci + 1}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {colTasks.map((task, ri) => {
                  const isCursor = isActiveCol && ri === rowIdx;
                  const isSelected = selectedIds.has(task.id);
                  let bg = "hover:bg-accent/50";
                  if (isSelected) bg = "bg-primary/10";
                  else if (isCursor) bg = "bg-accent";
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
                      className={`border-b border-border/40 p-3 cursor-grab active:cursor-grabbing transition-colors ${bg} ${
                        dragId === task.id ? "opacity-40" : ""
                      }`}
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
                              # {task.category}
                            </span>
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
                })}
              </div>
            </section>
          );
        })}
      </div>
      <TaskDetail
        task={selectedTask}
        open={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}
