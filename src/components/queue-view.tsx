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
import { getLineNumber } from "@/contexts/line-numbers";
import { useNavigation } from "@/contexts/navigation";
import { useTaskPanel } from "@/contexts/task-panel";
import { useUndo } from "@/contexts/undo";
import type { TaskStatus } from "@/core/types";
import type { UndoMutation } from "@/core/undo";
import type { RankedTask } from "@/core/urgency";
import { useKeyboard } from "@/hooks/use-keyboard";
import { useRecurrenceDelete } from "@/hooks/use-recurrence-delete";
import { cn, formatRelativeDate, isInputFocused, isOverdue } from "@/lib/utils";

const STATUS_SIGIL: Record<TaskStatus, string> = {
  pending: "\u00b7",
  wip: "~",
  done: "\u2713",
  blocked: "\u00d7",
  cancelled: "\u2013",
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

export function QueueView({
  tasks,
  categoryColors,
}: {
  tasks: RankedTask[];
  categoryColors: Record<string, string>;
}) {
  const nav = useNavigation();
  const undo = useUndo();
  const panel = useTaskPanel();
  const recurrenceDelete = useRecurrenceDelete();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!searchQuery) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q),
    );
  }, [tasks, searchQuery]);

  const gutterWidth = String(filtered.length).length;

  const { cursor, setCursor, selectedIds, toggleSelect } = useKeyboard({
    tasks: filtered,
    onComplete: (ids) => {
      const entryId = `complete-${Date.now()}-${ids.join(",")}`;
      const mutations: UndoMutation[] = ids.map((id) => {
        const task = filtered.find((t) => t.id === id);
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
    onDelete: (ids) => {
      if (ids.length === 1) {
        const task = filtered.find((t) => t.id === ids[0]);
        if (task?.recurrence && recurrenceDelete.requestDelete(task)) return;
      }
      const entryId = `delete-${Date.now()}-${ids.join(",")}`;
      const mutations = ids.map((id) => {
        const task = filtered.find((t) => t.id === id);
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
      if (panel.taskId && ids.includes(panel.taskId)) panel.close();
    },
    onStatusChange: (ids, status) => {
      const entryId = `status-${Date.now()}-${ids.join(",")}`;
      const mutations = ids.map((id) => {
        const task = filtered.find((t) => t.id === id);
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
    onCreate: () => panel.create(),
    onSelect: (task) => {
      nav.pushJump();
      panel.toggle(task.id);
    },
    onDeselect: () => panel.close(),
    onHelp: () => window.dispatchEvent(new Event("open-keymap-help")),
    onJump: () => nav.pushJump(),
    scrollRef,
  });

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

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchActive(false);
  }, []);

  const openSearch = useCallback(() => {
    setSearchActive(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  useEffect(() => {
    function handleSearchKeys(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !searchActive &&
        !e.ctrlKey &&
        !e.metaKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        !(document.activeElement as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        openSearch();
      }
      if (e.key === "Escape" && searchActive && !isInputFocused()) {
        e.preventDefault();
        clearSearch();
      }
    }
    window.addEventListener("keydown", handleSearchKeys);
    return () => window.removeEventListener("keydown", handleSearchKeys);
  }, [searchActive, openSearch, clearSearch]);

  useEffect(() => {
    if (cursor >= 0 && cursor < filtered.length) {
      const el = rowRefs.current.get(filtered[cursor].id);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [cursor, filtered]);

  function handleRowClick(task: RankedTask, idx: number, e: React.MouseEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      toggleSelect(task.id);
      return;
    }
    nav.pushJump();
    setCursor(idx);
    panel.open(task.id);
  }

  return (
    <div className="flex flex-col h-full">
      {searchActive && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border">
          <span className="text-xs text-primary font-bold">/</span>
          <Input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                clearSearch();
              }
              if (e.key === "Enter") {
                e.preventDefault();
                (document.activeElement as HTMLElement)?.blur();
              }
            }}
            placeholder="filter tasks..."
            className="h-6 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
          />
          <span className="text-[10px] text-muted-foreground shrink-0">
            {filtered.length}/{tasks.length}
          </span>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <span className="text-4xl font-light mb-2">&delta;</span>
            <span className="text-sm">no tasks in queue</span>
          </div>
        ) : (
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
                  )}
                  style={{
                    borderLeftColor:
                      isCursor || isSelected
                        ? undefined
                        : (categoryColors[task.category ?? ""] ??
                          "transparent"),
                  }}
                  onClick={(e) => handleRowClick(task, i, e)}
                  onKeyDown={() => {}}
                  tabIndex={0}
                  role="row"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "text-xs text-right tabular-nums shrink-0",
                        isCursor
                          ? "text-cursor-line-nr font-bold"
                          : "text-line-nr",
                      )}
                      style={{ minWidth: `${gutterWidth}ch` }}
                    >
                      {getLineNumber(i, cursor)}
                    </span>
                    <button
                      type="button"
                      className={`w-4 text-xs shrink-0 text-center hover:underline ${STATUS_COLOR[task.status as TaskStatus]}`}
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
                      {STATUS_SIGIL[task.status as TaskStatus]}
                    </button>
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
                        paddingLeft: `calc(${gutterWidth}ch + 1.5rem)`,
                      }}
                    >
                      {task.category && <span># {task.category}</span>}
                      {task.category && task.due && <span>&middot;</span>}
                      {task.due && (
                        <span
                          className={cn(
                            "tabular-nums",
                            isOverdue(task.due) && "text-destructive",
                          )}
                        >
                          {formatRelativeDate(new Date(task.due))}
                        </span>
                      )}
                      {task.location && (task.category || task.due) && (
                        <span>&middot;</span>
                      )}
                      {task.location && (
                        <span className="inline-flex items-center gap-0.5 truncate max-w-[20ch]">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {task.location}
                        </span>
                      )}
                      {task.meetingUrl && (
                        <Video className="w-3 h-3 shrink-0" />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
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
