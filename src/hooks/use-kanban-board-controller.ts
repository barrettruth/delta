"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigation } from "@/contexts/navigation";
import { useStatusBar } from "@/contexts/status-bar";
import { useTaskPanel } from "@/contexts/task-panel";
import { KANBAN_COLUMNS, type TaskStatusColumn } from "@/core/task-status";
import type { Task, TaskStatus } from "@/core/types";
import {
  type TaskOperations,
  useTaskOperations,
} from "@/hooks/use-task-operations";
import { useTaskSearch } from "@/hooks/use-task-search";
import {
  groupKanbanTasksByStatus,
  type KanbanTaskGroups,
  kanbanTaskIdRangeSet,
  kanbanVisibleColumns,
  moveKanbanVisibleColumnIndex,
} from "@/lib/kanban-board";
import { registerScopedKeydown } from "@/lib/keyboard";
import { getKeymap } from "@/lib/keymap-defs";

interface KanbanKeyBindings {
  colLeft: string;
  colRight: string;
  columnHints: string[];
  deleteKey: string;
  edit: string;
  escape: string;
  moveLeft: string;
  moveRight: string;
  rowDown: string;
  rowUp: string;
  search: string;
  statusForKey: Partial<Record<string, TaskStatus>>;
  swapLeft: string;
  swapRight: string;
  toggleSelect: string;
  visualMode: string;
}

export interface KanbanSearchController {
  active: boolean;
  handleInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  query: string;
  resultCount: number;
  searchRef: RefObject<HTMLInputElement | null>;
  setQuery: (value: SetStateAction<string>) => void;
  totalCount: number;
}

export interface KanbanGridController {
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

export interface KanbanBoardController {
  grid: KanbanGridController;
  recurrenceDelete: TaskOperations["recurrenceDelete"];
  search: KanbanSearchController;
}

function getKanbanKeyBindings(): KanbanKeyBindings {
  const r = (id: string) => getKeymap(id).triggerKey;
  return {
    columnHints: [
      r("kanban.jump_waiting"),
      r("kanban.jump_in_progress"),
      r("kanban.jump_blocked"),
      r("kanban.jump_done"),
    ],
    statusForKey: {
      [r("kanban.set_waiting")]: "pending",
      [r("kanban.set_in_progress")]: "wip",
      [r("kanban.set_blocked")]: "blocked",
      [r("kanban.complete")]: "done",
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
  };
}

export function useKanbanBoardController({
  tasks,
}: {
  tasks: Task[];
}): KanbanBoardController {
  const nav = useNavigation();
  const statusBar = useStatusBar();
  const panel = useTaskPanel();
  const taskOperations = useTaskOperations({ tasks });

  const k = useMemo(() => getKanbanKeyBindings(), []);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const [colIdx, setColIdx] = useState(0);
  const [rowIdx, setRowIdx] = useState(0);
  const [kbActive, setKbActive] = useState(false);
  const [columns, setColumns] = useState<TaskStatusColumn[]>(KANBAN_COLUMNS);
  const [visualMode, setVisualMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const visualAnchor = useRef(-1);

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

  const grouped = useMemo(
    () => groupKanbanTasksByStatus(filteredTasks),
    [filteredTasks],
  );

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
    setSelectedIds(
      kanbanTaskIdRangeSet(colTasks, visualAnchor.current, rowIdx),
    );
  }, [rowIdx, colIdx, visualMode, grouped, columns]);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === k.colLeft) {
        e.preventDefault();
        if (!visualMode) {
          setKbActive(true);
          setColIdx((c) =>
            moveKanbanVisibleColumnIndex({
              columns,
              currentIndex: c,
              delta: -1,
              grouped,
            }),
          );
          setRowIdx(0);
        }
      } else if (e.key === k.colRight) {
        e.preventDefault();
        if (!visualMode) {
          setKbActive(true);
          setColIdx((c) =>
            moveKanbanVisibleColumnIndex({
              columns,
              currentIndex: c,
              delta: 1,
              grouped,
            }),
          );
          setRowIdx(0);
        }
      } else if (e.key === k.rowDown) {
        e.preventDefault();
        setKbActive(true);
        setRowIdx((r) => {
          const colTasks = getColTasks(colIdx);
          if (colTasks.length === 0) return 0;
          return Math.min(r + 1, colTasks.length - 1);
        });
      } else if (e.key === k.rowUp) {
        e.preventDefault();
        setKbActive(true);
        setRowIdx((r) => Math.max(r - 1, 0));
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
        } else if (kbActive) {
          const colTasks = getColTasks(colIdx);
          if (colTasks.length > 0 && rowIdx < colTasks.length) {
            kbDelete([colTasks[rowIdx].id]);
          }
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
    () => kanbanVisibleColumns(columns, grouped),
    [columns, grouped],
  );

  const openTask = useCallback(
    (taskId: number) => {
      nav.pushJump();
      panel.open(taskId);
    },
    [nav.pushJump, panel.open],
  );

  return {
    grid: {
      colIdx,
      columnHints: k.columnHints,
      columns,
      dragId,
      dragOver,
      grouped,
      kbActive,
      onDropTask: handleDrop,
      onOpenTask: openTask,
      rowIdx,
      selectedIds,
      setDragId,
      setDragOver,
      visibleColumns,
    },
    recurrenceDelete: taskOperations.recurrenceDelete,
    search: {
      active: searchActive,
      handleInputKeyDown: handleSearchInputKeyDown,
      query: searchQuery,
      resultCount,
      searchRef,
      setQuery: setSearchQuery,
      totalCount,
    },
  };
}
