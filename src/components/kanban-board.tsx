"use client";

import { MapPinSimple, VideoCamera } from "@phosphor-icons/react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TaskOperationDialogs } from "@/components/task-operation-dialogs";
import { TaskSearchBar } from "@/components/task-search-bar";
import { useNavigation } from "@/contexts/navigation";
import { useStatusBar } from "@/contexts/status-bar";
import { useTaskPanel } from "@/contexts/task-panel";
import { KANBAN_COLUMNS, type TaskStatusColumn } from "@/core/task-status";
import type { Task, TaskStatus } from "@/core/types";
import { useTaskOperations } from "@/hooks/use-task-operations";
import { useTaskSearch } from "@/hooks/use-task-search";
import { registerScopedKeydown } from "@/lib/keyboard";
import { getKeymap } from "@/lib/keymap-defs";
import { formatDate } from "@/lib/utils";

type BoardColumn = TaskStatusColumn;

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

type KanbanGridProps = {
  visibleColumns: BoardColumn[];
  columns: BoardColumn[];
  grouped: Record<string, Task[]>;
  kbActive: boolean;
  colIdx: number;
  rowIdx: number;
  dragId: number | null;
  dragOver: TaskStatus | null;
  selectedIds: Set<number>;
  columnHints: string[];
  setDragOver: (status: TaskStatus | null) => void;
  setDragId: (taskId: number | null) => void;
  onDropTask: (taskId: number, newStatus: TaskStatus) => void;
  onOpenTask: (taskId: number) => void;
};

const KanbanGrid = memo(function KanbanGrid({
  visibleColumns,
  columns,
  grouped,
  kbActive,
  colIdx,
  rowIdx,
  dragId,
  dragOver,
  selectedIds,
  columnHints,
  setDragOver,
  setDragId,
  onDropTask,
  onOpenTask,
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
                if (id) onDropTask(id, col.status);
                setDragId(null);
                setDragOver(null);
              }}
            >
              <div className="flex items-center justify-between h-8 px-3 border-b border-border/60">
                <span className="text-xs font-medium">{col.label}</span>
                <kbd className="text-[10px] text-muted-foreground">
                  {columnHints[ci]}
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
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
});

export function KanbanBoard({ tasks }: { tasks: Task[] }) {
  const nav = useNavigation();
  const statusBar = useStatusBar();
  const panel = useTaskPanel();
  const taskOperations = useTaskOperations({ tasks });

  const k = useMemo(() => {
    const r = (id: string) => getKeymap(id).triggerKey;
    return {
      columnHints: [
        r("kanban.jump_waiting"),
        r("kanban.jump_in_progress"),
        r("kanban.jump_blocked"),
        r("kanban.jump_done"),
      ],
      statusForKey: {
        [r("kanban.set_waiting")]: "pending" as TaskStatus,
        [r("kanban.set_in_progress")]: "wip" as TaskStatus,
        [r("kanban.set_blocked")]: "blocked" as TaskStatus,
        [r("kanban.complete")]: "done" as TaskStatus,
      },
      colLeft: r("kanban.col_left"),
      colRight: r("kanban.col_right"),
      rowDown: r("kanban.row_down"),
      rowUp: r("kanban.row_up"),
      moveLeft: r("kanban.move_task_left"),
      moveRight: r("kanban.move_task_right"),
      swapLeft: r("kanban.swap_col_left"),
      swapRight: r("kanban.swap_col_right"),
      edit: r("kanban.edit"),
      toggleSelect: r("kanban.toggle_select"),
      visualMode: r("kanban.visual_mode"),
      deleteKey: r("kanban.delete"),
      search: r("kanban.search"),
      escape: r("kanban.escape"),
      jumpBottom: r("queue.jump_bottom"),
    };
  }, []);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [colIdx, setColIdx] = useState(0);
  const [rowIdx, setRowIdx] = useState(0);
  const [kbActive, setKbActive] = useState(false);
  const [columns, setColumns] = useState<BoardColumn[]>(KANBAN_COLUMNS);
  const [visualMode, setVisualMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const visualAnchor = useRef(-1);
  const pendingOp = useRef<{ key: string; preCount: number | null } | null>(
    null,
  );
  const opTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countBuf = useRef("");

  const kbDelete = taskOperations.deleteTasks;
  const kbMoveToStatus = taskOperations.moveTasksToStatus;
  const searchPersistence = useMemo(
    () => ({
      load: () => nav.getViewState<string>("kanban:search"),
      save: (query: string | undefined) =>
        nav.saveViewState("kanban:search", query),
    }),
    [nav.getViewState, nav.saveViewState],
  );
  const {
    active: searchActive,
    clear: clearSearch,
    filteredTasks,
    handleInputKeyDown: handleSearchInputKeyDown,
    open: openSearch,
    query: searchQuery,
    resultCount,
    searchRef,
    setQuery: setSearchQuery,
    totalCount,
  } = useTaskSearch({ tasks, persistence: searchPersistence });

  const grouped = useMemo(() => groupByStatus(filteredTasks), [filteredTasks]);

  useEffect(() => {
    const left = visualMode ? "-- VISUAL --" : "-- KANBAN --";
    const counts = columns
      .map((col) => {
        const n = (grouped[col.status] ?? []).length;
        return n > 0 ? `${n} ${col.label}` : "";
      })
      .filter(Boolean)
      .join(" / ");
    statusBar.setIdle(left, counts);
  }, [visualMode, statusBar.setIdle, grouped, columns]);

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
      if (pendingOp.current) {
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
        } else if (e.key === k.rowDown) {
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
        } else if (e.key === k.rowUp) {
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
        } else if (e.key === k.jumpBottom) {
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

      if (e.key === k.colLeft) {
        e.preventDefault();
        if (!visualMode) {
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
        }
      } else if (e.key === k.colRight) {
        e.preventDefault();
        if (!visualMode) {
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
        }
      } else if (e.key === k.rowDown) {
        e.preventDefault();
        setKbActive(true);
        setRowIdx((r) => {
          const colTasks = getColTasks(colIdx);
          return Math.min(r + n, colTasks.length - 1);
        });
      } else if (e.key === k.rowUp) {
        e.preventDefault();
        setKbActive(true);
        setRowIdx((r) => Math.max(r - n, 0));
      } else if (e.key === k.moveLeft) {
        e.preventDefault();
        const newColH = Math.max(colIdx - 1, 0);
        if (newColH !== colIdx) {
          const newStatusH = columns[newColH].status;
          if (selectedIds.size > 0) {
            kbMoveToStatus([...selectedIds], newStatusH);
            setSelectedIds(new Set());
            setVisualMode(false);
          } else {
            const colTasksH = getColTasks(colIdx);
            if (colTasksH.length > 0 && rowIdx < colTasksH.length) {
              kbMoveToStatus([colTasksH[rowIdx].id], newStatusH);
            }
          }
          setColIdx(newColH);
          setRowIdx(0);
        }
      } else if (e.key === k.moveRight) {
        e.preventDefault();
        const newColL = Math.min(colIdx + 1, columns.length - 1);
        if (newColL !== colIdx) {
          const newStatusL = columns[newColL].status;
          if (selectedIds.size > 0) {
            kbMoveToStatus([...selectedIds], newStatusL);
            setSelectedIds(new Set());
            setVisualMode(false);
          } else {
            const colTasksL = getColTasks(colIdx);
            if (colTasksL.length > 0 && rowIdx < colTasksL.length) {
              kbMoveToStatus([colTasksL[rowIdx].id], newStatusL);
            }
          }
          setColIdx(newColL);
          setRowIdx(0);
        }
      } else if (e.key === k.swapLeft) {
        e.preventDefault();
        if (!visualMode && colIdx > 0) {
          setColumns((prev) => {
            const next = [...prev];
            [next[colIdx - 1], next[colIdx]] = [next[colIdx], next[colIdx - 1]];
            return next;
          });
          setColIdx((c) => c - 1);
        }
      } else if (e.key === k.swapRight) {
        e.preventDefault();
        if (!visualMode && colIdx < columns.length - 1) {
          setColumns((prev) => {
            const next = [...prev];
            [next[colIdx], next[colIdx + 1]] = [next[colIdx + 1], next[colIdx]];
            return next;
          });
          setColIdx((c) => c + 1);
        }
      } else if (e.key === k.edit) {
        e.preventDefault();
        const colTasks = getColTasks(colIdx);
        if (kbActive && colTasks.length > 0 && rowIdx < colTasks.length) {
          nav.pushJump();
          panel.toggle(colTasks[rowIdx].id);
        } else {
          panel.create();
        }
      } else if (k.statusForKey[e.key]) {
        e.preventDefault();
        if (kbActive || selectedIds.size > 0) {
          const newStatus = k.statusForKey[e.key];
          if (newStatus) {
            if (selectedIds.size > 0) {
              kbMoveToStatus([...selectedIds], newStatus);
              setSelectedIds(new Set());
              setVisualMode(false);
            } else {
              const colTasks = getColTasks(colIdx);
              if (colTasks.length > 0 && rowIdx < colTasks.length) {
                kbMoveToStatus([colTasks[rowIdx].id], newStatus);
              }
            }
            const targetCol = columns.findIndex((c) => c.status === newStatus);
            if (targetCol !== -1) {
              setColIdx(targetCol);
              setRowIdx(0);
            }
          }
        }
      } else if (k.columnHints.includes(e.key)) {
        e.preventDefault();
        const jumpIdx = k.columnHints.indexOf(e.key);
        if (jumpIdx !== -1 && jumpIdx < columns.length) {
          setKbActive(true);
          setColIdx(jumpIdx);
          setRowIdx(0);
        }
      } else if (e.key === k.toggleSelect) {
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
      } else if (e.key === k.visualMode) {
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
      } else if (e.key === k.deleteKey) {
        e.preventDefault();
        if (selectedIds.size > 0) {
          kbDelete([...selectedIds]);
          setSelectedIds(new Set());
          setVisualMode(false);
        } else {
          const parsedCount = rawCount ? Number.parseInt(rawCount, 10) : null;
          pendingOp.current = { key: k.deleteKey, preCount: parsedCount };
          opTimer.current = setTimeout(() => {
            pendingOp.current = null;
            opTimer.current = null;
          }, 500);
        }
      } else if (e.key === k.search) {
        e.preventDefault();
        openSearch();
      } else if (e.key === k.escape) {
        if (searchActive) {
          clearSearch();
        } else if (visualMode) {
          setVisualMode(false);
          setSelectedIds(new Set());
        } else {
          setKbActive(false);
          setColIdx(0);
          setRowIdx(0);
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
      clearSearch,
      openSearch,
      nav,
      kbDelete,
      kbMoveToStatus,
      grouped,
      k,
    ],
  );

  useEffect(() => {
    return registerScopedKeydown(
      window,
      { scope: "view", taskPanelOpen: panel.isOpen },
      handler,
    );
  }, [handler, panel.isOpen]);

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

  const handleDrop = useCallback(
    (taskId: number, newStatus: TaskStatus) => {
      taskOperations.moveTasksToStatus([taskId], newStatus);
    },
    [taskOperations],
  );

  const visibleColumns = useMemo(
    () => columns.filter((col) => (grouped[col.status] ?? []).length > 0),
    [columns, grouped],
  );
  const openTask = useCallback(
    (taskId: number) => {
      nav.pushJump();
      panel.open(taskId);
    },
    [nav.pushJump, panel.open],
  );

  return (
    <div className="flex flex-col h-full w-full">
      {searchActive && (
        <TaskSearchBar
          className="px-4 border-border/60 shrink-0"
          inputRef={searchRef}
          onInputKeyDown={handleSearchInputKeyDown}
          onQueryChange={setSearchQuery}
          query={searchQuery}
          resultCount={resultCount}
          slashClassName="text-muted-foreground"
          totalCount={totalCount}
        />
      )}
      <KanbanGrid
        visibleColumns={visibleColumns}
        columns={columns}
        grouped={grouped}
        kbActive={kbActive}
        colIdx={colIdx}
        rowIdx={rowIdx}
        dragId={dragId}
        dragOver={dragOver}
        selectedIds={selectedIds}
        columnHints={k.columnHints}
        setDragOver={setDragOver}
        setDragId={setDragId}
        onDropTask={handleDrop}
        onOpenTask={openTask}
      />
      <TaskOperationDialogs
        recurrenceDelete={taskOperations.recurrenceDelete}
      />
    </div>
  );
}
