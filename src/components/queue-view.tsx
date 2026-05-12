"use client";

import { MapPinSimple, VideoCamera } from "@phosphor-icons/react";
import { memo, useCallback, useEffect, useRef } from "react";
import { TaskOperationDialogs } from "@/components/task-operation-dialogs";
import { TaskSearchBar } from "@/components/task-search-bar";
import { useKeyboardHelp } from "@/contexts/keyboard-help";
import { getLineNumber } from "@/contexts/line-numbers";
import { useNavigation } from "@/contexts/navigation";
import { useStatusBar } from "@/contexts/status-bar";
import { useTaskPanel } from "@/contexts/task-panel";
import type { TaskStatus } from "@/core/types";
import type { RankedTask } from "@/core/urgency";
import { useKeyboard } from "@/hooks/use-keyboard";
import { useTaskOperations } from "@/hooks/use-task-operations";
import { useTaskSearch } from "@/hooks/use-task-search";
import { registerScopedKeydown } from "@/lib/keyboard";
import { cn, formatRelativeDate, isOverdue } from "@/lib/utils";

const STATUS_BORDER: Record<TaskStatus, string> = {
  pending: "border-l-status-pending",
  wip: "border-l-status-wip",
  done: "border-l-status-done",
  blocked: "border-l-status-blocked",
  cancelled: "border-l-status-cancelled",
};

function getRowClasses(isCursor: boolean, isSelected: boolean): string {
  if (isSelected && isCursor) return "border-primary bg-primary/15";
  if (isSelected) return "border-primary/60 bg-primary/10";
  if (isCursor) return "border-primary bg-accent/60";
  return "border-transparent hover:bg-accent/30";
}

function getTaskDimming(status: string): string {
  if (status === "blocked") return "opacity-50";
  if (status === "done") return "opacity-40";
  if (status === "cancelled") return "opacity-30";
  return "";
}

type QueueTaskListProps = {
  filtered: RankedTask[];
  cursor: number;
  selectedIds: Set<number>;
  gutterWidth: number;
  rowRefs: { current: Map<number, HTMLDivElement> };
  openTask: (taskId: number, index: number) => void;
  toggleSelect: (taskId: number) => void;
};

const QueueTaskList = memo(function QueueTaskList({
  filtered,
  cursor,
  selectedIds,
  gutterWidth,
  rowRefs,
  openTask,
  toggleSelect,
}: QueueTaskListProps) {
  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span className="text-4xl font-light mb-2">&delta;</span>
        <span className="text-sm">no tasks in queue</span>
      </div>
    );
  }

  return (
    <div>
      {filtered.map((task, i) => {
        const isCursor = i === cursor;
        const isSelected = selectedIds.has(task.id);

        return (
          <div
            key={task.id}
            ref={(el) => {
              if (el) rowRefs.current.set(task.id, el);
            }}
            className={cn(
              "w-full pl-2 pr-4 py-2.5 md:py-1.5 cursor-pointer text-left select-none border-l-2",
              getRowClasses(isCursor, isSelected),
              getTaskDimming(task.status),
              !isCursor &&
                !isSelected &&
                STATUS_BORDER[task.status as TaskStatus],
            )}
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                toggleSelect(task.id);
                return;
              }
              openTask(task.id, i);
            }}
            onKeyDown={() => {}}
            tabIndex={0}
            role="row"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  "text-xs text-right tabular-nums shrink-0",
                  isCursor ? "text-cursor-line-nr font-bold" : "text-line-nr",
                )}
                style={{ minWidth: `${gutterWidth}ch` }}
              >
                {getLineNumber(i, cursor)}
              </span>
              <span
                className={cn(
                  "text-sm truncate",
                  task.status === "done" &&
                    "line-through text-muted-foreground",
                  task.status === "cancelled" &&
                    "line-through text-muted-foreground",
                )}
              >
                {task.description}
              </span>
            </div>
            {(task.category ||
              task.due ||
              task.location ||
              task.meetingUrl) && (
              <div
                className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"
                style={{
                  paddingLeft: `calc(${gutterWidth}ch + 0.5rem)`,
                }}
              >
                {task.category && <span># {task.category}</span>}
                {task.location && task.category && <span>&middot;</span>}
                {task.location && (
                  <span className="inline-flex items-center gap-0.5 truncate max-w-[20ch]">
                    <MapPinSimple className="w-3 h-3 shrink-0" />
                    {task.location}
                  </span>
                )}
                {task.meetingUrl && (
                  <VideoCamera className="w-3 h-3 shrink-0" />
                )}
                {task.due && (
                  <span
                    className={cn(
                      "tabular-nums ml-auto",
                      isOverdue(task.due) && "text-destructive",
                    )}
                  >
                    {formatRelativeDate(new Date(task.due))}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

export function QueueView({
  tasks,
  categoryFilter,
}: {
  tasks: RankedTask[];
  categoryColors: Record<string, string>;
  categoryFilter?: string;
}) {
  const nav = useNavigation();
  const { openKeyboardHelp } = useKeyboardHelp();
  const statusBar = useStatusBar();
  const panel = useTaskPanel();
  const {
    active: searchActive,
    clear: clearSearch,
    filteredTasks: filtered,
    handleInputKeyDown: handleSearchInputKeyDown,
    open: openSearch,
    query: searchQuery,
    resultCount,
    searchRef,
    setQuery: setSearchQuery,
    totalCount,
  } = useTaskSearch({ tasks });
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  const taskOperations = useTaskOperations({ tasks: filtered });
  const gutterWidth = String(filtered.length).length;
  const openHelp = useCallback(() => {
    openKeyboardHelp();
  }, [openKeyboardHelp]);

  const { cursor, setCursor, selectedIds, toggleSelect, visualMode } =
    useKeyboard({
      tasks: filtered,
      onComplete: taskOperations.completeTasks,
      onDelete: taskOperations.deleteTasks,
      onStatusChange: taskOperations.changeTaskStatus,
      onCreate: () => panel.create(),
      onSelect: (task) => {
        nav.pushJump();
        panel.toggle(task.id);
      },
      onDeselect: () => panel.close(),
      onHelp: openHelp,
      onJump: () => nav.pushJump(),
      scrollRef,
      taskPanelOpen: panel.isOpen,
    });

  useEffect(() => {
    const left = visualMode
      ? "-- VISUAL --"
      : categoryFilter
        ? `-- QUEUE -- # ${categoryFilter}`
        : "-- QUEUE --";
    const right =
      filtered.length > 0 && cursor >= 0
        ? `${cursor + 1}/${filtered.length}`
        : filtered.length > 0
          ? `0/${filtered.length}`
          : "";
    statusBar.setIdle(left, right);
  }, [visualMode, categoryFilter, cursor, filtered.length, statusBar.setIdle]);

  useEffect(() => {
    const saved = nav.getViewState<number>("queue:cursor");
    if (saved !== undefined && saved >= 0 && saved < filtered.length) {
      setCursor(saved);
    }
  }, [filtered.length, nav.getViewState, setCursor]);

  useEffect(() => {
    if (cursor >= 0) nav.saveViewState("queue:cursor", cursor);
  }, [cursor, nav]);

  useEffect(() => {
    const pendingId = nav.consumePendingTaskDetail();
    if (pendingId != null) {
      panel.open(pendingId);
    }
  }, [nav.consumePendingTaskDetail, panel]);

  useEffect(() => {
    nav.registerScrollContainer(scrollRef.current);
    return () => nav.registerScrollContainer(null);
  }, [nav.registerScrollContainer]);

  useEffect(() => {
    function handleSearchKeys(e: KeyboardEvent) {
      if (e.key === "/" && !searchActive && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        openSearch();
      }
      if (e.key === "Escape" && searchActive) {
        e.preventDefault();
        clearSearch();
      }
    }
    return registerScopedKeydown(
      window,
      { scope: "view", taskPanelOpen: panel.isOpen },
      handleSearchKeys,
    );
  }, [searchActive, openSearch, clearSearch, panel.isOpen]);

  useEffect(() => {
    if (cursor >= 0 && cursor < filtered.length) {
      const el = rowRefs.current.get(filtered[cursor].id);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [cursor, filtered]);

  const openTask = useCallback(
    (taskId: number, index: number) => {
      nav.pushJump();
      setCursor(index);
      panel.open(taskId);
    },
    [nav.pushJump, panel.open, setCursor],
  );

  return (
    <div className="flex flex-col h-full">
      {searchActive && (
        <TaskSearchBar
          className="px-3 border-border"
          inputRef={searchRef}
          onInputKeyDown={handleSearchInputKeyDown}
          onQueryChange={setSearchQuery}
          query={searchQuery}
          resultCount={resultCount}
          slashClassName="text-primary font-bold"
          totalCount={totalCount}
        />
      )}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <QueueTaskList
          filtered={filtered}
          cursor={cursor}
          selectedIds={selectedIds}
          gutterWidth={gutterWidth}
          rowRefs={rowRefs}
          openTask={openTask}
          toggleSelect={toggleSelect}
        />
      </div>
      <TaskOperationDialogs
        recurrenceDelete={taskOperations.recurrenceDelete}
      />
    </div>
  );
}
