"use client";

import { MapPin, Video } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  completeTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { RecurrenceStrategyDialog } from "@/components/recurrence-strategy-dialog";
import { Input } from "@/components/ui/input";
import { useNavigation } from "@/contexts/navigation";
import { useStatusBar } from "@/contexts/status-bar";
import { useTaskPanel } from "@/contexts/task-panel";
import { useUndo } from "@/contexts/undo";
import type { Task, TaskStatus } from "@/core/types";
import type { UndoMutation } from "@/core/undo";
import { useRecurrenceDelete } from "@/hooks/use-recurrence-delete";
import { formatDate, isBrowserShortcut, isInputFocused } from "@/lib/utils";

const COLUMN_HINTS = ["W", "I", "B", "X"];

const STATUS_FOR_KEY: Record<string, TaskStatus> = {
  w: "pending",
  i: "wip",
  b: "blocked",
  x: "done",
};

const defaultColumns: { status: TaskStatus; label: string }[] = [
  { status: "pending", label: "Waiting" },
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
  const nav = useNavigation();
  const statusBar = useStatusBar();
  const undo = useUndo();
  const panel = useTaskPanel();
  const recurrenceDelete = useRecurrenceDelete();
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
  const pendingOp = useRef<{ key: string; preCount: number | null } | null>(
    null,
  );
  const opTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countBuf = useRef("");

  useEffect(() => {
    const left = visualMode ? "-- VISUAL --" : "-- KANBAN --";
    statusBar.setIdle(left, "");
  }, [visualMode, statusBar]);

  const kbDelete = useCallback(
    (ids: number[]) => {
      if (ids.length === 1) {
        const task = tasks.find((t) => t.id === ids[0]);
        if (task?.recurrence && recurrenceDelete.requestDelete(task)) return;
      }
      const entryId = `delete-${Date.now()}-${ids.join(",")}`;
      const mutations = ids.map((id) => {
        const task = tasks.find((t) => t.id === id);
        return {
          taskId: id,
          restore: {
            status: (task?.status as TaskStatus) ?? "pending",
            completedAt: task?.completedAt ?? null,
          },
        };
      });
      undo.push({
        id: entryId,
        op: "delete",
        label: `${ids.length} task${ids.length > 1 ? "s" : ""} deleted`,
        mutations,
        timestamp: Date.now(),
      });
      for (const id of ids) deleteTaskAction(id);
    },
    [tasks, undo, recurrenceDelete],
  );

  const kbComplete = useCallback(
    (ids: number[]) => {
      const entryId = `complete-${Date.now()}-${ids.join(",")}`;
      const mutations: UndoMutation[] = ids.map((id) => {
        const task = tasks.find((t) => t.id === id);
        return {
          taskId: id,
          restore: {
            status: (task?.status as TaskStatus) ?? "pending",
            completedAt: task?.completedAt ?? null,
          },
        };
      });
      undo.push({
        id: entryId,
        op: "complete",
        label: `${ids.length} task${ids.length > 1 ? "s" : ""} completed`,
        mutations,
        timestamp: Date.now(),
      });
      for (const id of ids) {
        completeTaskAction(id).then((result) => {
          const m = mutations.find((mut) => mut.taskId === id);
          if (m && result && "data" in result) {
            m.spawnedTaskId = result.data?.spawnedTaskId ?? undefined;
          }
        });
      }
    },
    [tasks, undo],
  );

  const kbStatusChange = useCallback(
    (ids: number[], status: TaskStatus) => {
      const entryId = `status-${Date.now()}-${ids.join(",")}`;
      const mutations = ids.map((id) => {
        const task = tasks.find((t) => t.id === id);
        return {
          taskId: id,
          restore: {
            status: (task?.status as TaskStatus) ?? "pending",
            completedAt: task?.completedAt ?? null,
          },
        };
      });
      undo.push({
        id: entryId,
        op: "status-change",
        label: `${ids.length} task${ids.length > 1 ? "s" : ""} \u2192 ${status}`,
        mutations,
        timestamp: Date.now(),
      });
      for (const id of ids) updateTaskAction(id, { status });
    },
    [tasks, undo],
  );

  const kbMoveToStatus = useCallback(
    (ids: number[], newStatus: TaskStatus) => {
      if (newStatus === "done") kbComplete(ids);
      else kbStatusChange(ids, newStatus);
    },
    [kbComplete, kbStatusChange],
  );

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
      if (isBrowserShortcut(e)) return;
      if (panel.isOpen) return;

      if (pendingOp.current) {
        const isModifier = ["Shift", "Control", "Alt", "Meta"].includes(e.key);
        if (isModifier) return;

        if (
          (e.key >= "1" && e.key <= "9") ||
          (e.key === "0" && countBuf.current.length > 0)
        ) {
          e.preventDefault();
          countBuf.current += e.key;
          if (opTimer.current) {
            clearTimeout(opTimer.current);
          }
          opTimer.current = setTimeout(() => {
            pendingOp.current = null;
            opTimer.current = null;
            countBuf.current = "";
          }, 500);
          return;
        }

        const motionCount = countBuf.current
          ? Number.parseInt(countBuf.current, 10)
          : null;
        countBuf.current = "";
        const { key: op, preCount } = pendingOp.current;
        pendingOp.current = null;
        if (opTimer.current) {
          clearTimeout(opTimer.current);
          opTimer.current = null;
        }
        const pre = preCount ?? 1;
        if (e.key === op) {
          e.preventDefault();
          if (selectedIds.size > 0) {
            kbDelete([...selectedIds]);
            setSelectedIds(new Set());
            setVisualMode(false);
          } else if (kbActive) {
            const colTasks = getColTasks(colIdx);
            if (colTasks.length > 0 && rowIdx < colTasks.length) {
              const ids: number[] = [];
              for (
                let i = rowIdx;
                i < Math.min(rowIdx + pre, colTasks.length);
                i++
              ) {
                ids.push(colTasks[i].id);
              }
              if (ids.length > 0) kbDelete(ids);
            }
          }
        } else if (e.key === "j") {
          e.preventDefault();
          if (kbActive) {
            const colTasks = getColTasks(colIdx);
            if (colTasks.length > 0 && rowIdx < colTasks.length) {
              const n = pre * (motionCount ?? 1);
              const lo = rowIdx;
              const hi = Math.min(rowIdx + n, colTasks.length - 1);
              const ids: number[] = [];
              for (let i = lo; i <= hi; i++) ids.push(colTasks[i].id);
              if (ids.length > 0) kbDelete(ids);
            }
          }
        } else if (e.key === "k") {
          e.preventDefault();
          if (kbActive) {
            const colTasks = getColTasks(colIdx);
            if (colTasks.length > 0 && rowIdx < colTasks.length) {
              const n = pre * (motionCount ?? 1);
              const lo = Math.max(rowIdx - n, 0);
              const hi = rowIdx;
              const ids: number[] = [];
              for (let i = lo; i <= hi; i++) ids.push(colTasks[i].id);
              if (ids.length > 0) kbDelete(ids);
            }
          }
        } else if (e.key === "G") {
          e.preventDefault();
          if (kbActive) {
            const colTasks = getColTasks(colIdx);
            if (colTasks.length > 0 && rowIdx < colTasks.length) {
              const ids: number[] = [];
              for (let i = rowIdx; i < colTasks.length; i++)
                ids.push(colTasks[i].id);
              if (ids.length > 0) kbDelete(ids);
            }
          }
        }
        return;
      }

      if (e.key >= "1" && e.key <= "9" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        countBuf.current += e.key;
        return;
      }
      if (
        e.key === "0" &&
        countBuf.current.length > 0 &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        countBuf.current += e.key;
        return;
      }

      const rawCount = countBuf.current;
      countBuf.current = "";
      const n = rawCount ? Number.parseInt(rawCount, 10) : 1;

      switch (e.key) {
        case "h": {
          e.preventDefault();
          if (visualMode) break;
          setKbActive(true);
          setColIdx((c) => {
            const visibleIndices = columns
              .map((col, idx) => ({ idx, status: col.status }))
              .filter((col) => (grouped[col.status] ?? []).length > 0)
              .map((col) => col.idx);
            if (visibleIndices.length === 0) return c;
            const pos = visibleIndices.indexOf(c);
            const target =
              pos === -1 ? visibleIndices[0] : Math.max(pos - n, 0);
            return visibleIndices[target];
          });
          setRowIdx(0);
          break;
        }
        case "l": {
          e.preventDefault();
          if (visualMode) break;
          setKbActive(true);
          setColIdx((c) => {
            const visibleIndices = columns
              .map((col, idx) => ({ idx, status: col.status }))
              .filter((col) => (grouped[col.status] ?? []).length > 0)
              .map((col) => col.idx);
            if (visibleIndices.length === 0) return c;
            const pos = visibleIndices.indexOf(c);
            const target =
              pos === -1
                ? visibleIndices[0]
                : Math.min(pos + n, visibleIndices.length - 1);
            return visibleIndices[target];
          });
          setRowIdx(0);
          break;
        }
        case "j": {
          e.preventDefault();
          setKbActive(true);
          setRowIdx((r) => {
            const colTasks = getColTasks(colIdx);
            return Math.min(r + n, colTasks.length - 1);
          });
          break;
        }
        case "k": {
          e.preventDefault();
          setKbActive(true);
          setRowIdx((r) => Math.max(r - n, 0));
          break;
        }
        case "H": {
          e.preventDefault();
          const newColH = Math.max(colIdx - 1, 0);
          if (newColH === colIdx) break;
          const newStatusH = columns[newColH].status;
          if (selectedIds.size > 0) {
            kbMoveToStatus([...selectedIds], newStatusH);
            setSelectedIds(new Set());
            setVisualMode(false);
          } else {
            const colTasksH = getColTasks(colIdx);
            if (colTasksH.length === 0 || rowIdx >= colTasksH.length) break;
            kbMoveToStatus([colTasksH[rowIdx].id], newStatusH);
          }
          setColIdx(newColH);
          setRowIdx(0);
          break;
        }
        case "L": {
          e.preventDefault();
          const newColL = Math.min(colIdx + 1, columns.length - 1);
          if (newColL === colIdx) break;
          const newStatusL = columns[newColL].status;
          if (selectedIds.size > 0) {
            kbMoveToStatus([...selectedIds], newStatusL);
            setSelectedIds(new Set());
            setVisualMode(false);
          } else {
            const colTasksL = getColTasks(colIdx);
            if (colTasksL.length === 0 || rowIdx >= colTasksL.length) break;
            kbMoveToStatus([colTasksL[rowIdx].id], newStatusL);
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
        case "e": {
          e.preventDefault();
          const colTasks = getColTasks(colIdx);
          if (kbActive && colTasks.length > 0 && rowIdx < colTasks.length) {
            nav.pushJump();
            panel.toggle(colTasks[rowIdx].id);
          } else {
            panel.create();
          }
          break;
        }
        case "w":
        case "i":
        case "b":
        case "x": {
          e.preventDefault();
          if (!kbActive && selectedIds.size === 0) break;
          const newStatus = STATUS_FOR_KEY[e.key];
          if (!newStatus) break;
          if (selectedIds.size > 0) {
            kbMoveToStatus([...selectedIds], newStatus);
            setSelectedIds(new Set());
            setVisualMode(false);
          } else {
            const colTasks = getColTasks(colIdx);
            if (colTasks.length === 0 || rowIdx >= colTasks.length) break;
            kbMoveToStatus([colTasks[rowIdx].id], newStatus);
          }
          const targetCol = columns.findIndex((c) => c.status === newStatus);
          if (targetCol !== -1) {
            setColIdx(targetCol);
            setRowIdx(0);
          }
          break;
        }
        case "W":
        case "I":
        case "B":
        case "X": {
          e.preventDefault();
          const jumpIdx = COLUMN_HINTS.indexOf(e.key);
          if (jumpIdx !== -1 && jumpIdx < columns.length) {
            setKbActive(true);
            setColIdx(jumpIdx);
            setRowIdx(0);
          }
          break;
        }
        case "v": {
          e.preventDefault();
          if (visualMode) setVisualMode(false);
          if (kbActive) {
            const colTasks = getColTasks(colIdx);
            if (colTasks.length > 0 && rowIdx < colTasks.length) {
              const id = colTasks[rowIdx].id;
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }
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
        case "d": {
          e.preventDefault();
          if (selectedIds.size > 0) {
            kbDelete([...selectedIds]);
            setSelectedIds(new Set());
            setVisualMode(false);
          } else {
            const parsedCount = rawCount ? Number.parseInt(rawCount, 10) : null;
            pendingOp.current = { key: "d", preCount: parsedCount };
            opTimer.current = setTimeout(() => {
              pendingOp.current = null;
              opTimer.current = null;
            }, 500);
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
      panel,
      columns,
      kbActive,
      visualMode,
      selectedIds,
      searchActive,
      nav,
      kbDelete,
      kbMoveToStatus,
      grouped,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);

  useEffect(() => {
    const pendingId = nav.consumePendingTaskDetail();
    if (pendingId != null) {
      panel.open(pendingId);
    }
  }, [nav.consumePendingTaskDetail, panel]);

  useEffect(() => {
    const saved = nav.getViewState<{
      colIdx: number;
      rowIdx: number;
      kbActive: boolean;
    }>("kanban:cursor");
    if (saved && typeof saved === "object") {
      setColIdx(saved.colIdx);
      setRowIdx(saved.rowIdx);
      setKbActive(saved.kbActive);
    }
  }, [nav.getViewState]);

  useEffect(() => {
    if (kbActive) {
      nav.saveViewState("kanban:cursor", { colIdx, rowIdx, kbActive });
    }
  }, [colIdx, rowIdx, kbActive, nav]);

  useEffect(() => {
    const saved = nav.getViewState<string>("kanban:search");
    if (typeof saved === "string") {
      setSearchQuery(saved);
      setSearchActive(true);
    }
  }, [nav.getViewState]);

  useEffect(() => {
    nav.saveViewState("kanban:search", searchQuery || undefined);
  }, [searchQuery, nav]);

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
      {visibleColumns.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 min-h-0 text-muted-foreground">
          <span className="text-4xl font-light mb-2">&delta;</span>
          <span className="text-sm">no tasks on board</span>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-x-auto">
          <div
            className={`grid ${gridCols} gap-0 h-full`}
            style={{ minWidth: `${visibleColumns.length * 200}px` }}
          >
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
                    <kbd className="text-[10px] text-muted-foreground">
                      {COLUMN_HINTS[ci]}
                    </kbd>
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
                            e.dataTransfer.setData(
                              "text/plain",
                              String(task.id),
                            );
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
                            onClick={() => {
                              nav.pushJump();
                              panel.open(task.id);
                            }}
                          >
                            <p className="text-sm font-medium leading-snug">
                              {task.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              {task.category && task.category !== "Todo" && (
                                <span className="text-xs text-muted-foreground">
                                  # {task.category}
                                </span>
                              )}
                              {task.location && (
                                <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground truncate max-w-[16ch]">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  {task.location}
                                </span>
                              )}
                              {task.meetingUrl && (
                                <Video className="w-3 h-3 shrink-0 text-muted-foreground" />
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
        </div>
      )}
      <RecurrenceStrategyDialog
        open={!!recurrenceDelete.pending}
        onOpenChange={(open) => {
          if (!open) recurrenceDelete.cancel();
        }}
        mode="delete"
        onSelect={(strategy) => {
          recurrenceDelete.executeStrategy(strategy);
        }}
      />
    </div>
  );
}
