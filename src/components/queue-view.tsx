"use client";

import { Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  completeTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { TaskDetail } from "@/components/task-detail";
import { Input } from "@/components/ui/input";
import { getLineNumber } from "@/contexts/line-numbers";
import type { TaskStatus } from "@/core/types";

import type { RankedTask } from "@/core/urgency";
import { useKeyboard } from "@/hooks/use-keyboard";
import { formatDate, isInputFocused } from "@/lib/utils";

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

export function QueueView({ tasks }: { tasks: RankedTask[] }) {
  const [selectedTask, setSelectedTask] = useState<RankedTask | null>(null);
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
        t.category?.toLowerCase().includes(q) ||
        t.label?.toLowerCase().includes(q),
    );
  }, [tasks, searchQuery]);

  const gutterWidth = String(filtered.length).length;

  const { cursor, setCursor, selectedIds, toggleSelect } = useKeyboard({
    tasks: filtered,
    onComplete: (ids) => {
      for (const id of ids) completeTaskAction(id);
    },
    onDelete: (ids) => {
      for (const id of ids) deleteTaskAction(id);
      if (selectedTask && ids.includes(selectedTask.id)) setSelectedTask(null);
    },
    onStatusChange: (ids, status) => {
      for (const id of ids) updateTaskAction(id, { status });
    },
    onSelect: (task) => setSelectedTask(task as RankedTask),
    onDeselect: () => setSelectedTask(null),
    onHelp: () => window.dispatchEvent(new Event("open-keymap-help")),
    scrollRef,
  });

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
    setCursor(idx);
    setSelectedTask(task);
  }

  return (
    <div className="flex flex-col h-full">
      {searchActive && (
        <div className="flex items-center gap-2 px-6 py-1.5 border-b border-border/60">
          <span className="text-xs text-muted-foreground">/</span>
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
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16">
            <Zap className="size-10 opacity-40" />
            <p className="text-sm">
              {searchQuery ? "No matches" : "Nothing urgent"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filtered.map((task, i) => {
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
                  className={`flex w-full items-center gap-3 pl-3 pr-6 py-2.5 cursor-pointer transition-colors text-left select-none ${bg}`}
                  onClick={(e) => handleRowClick(task, i, e)}
                  onKeyDown={() => {}}
                  tabIndex={0}
                  role="row"
                >
                  <span
                    className={`text-xs text-right tabular-nums shrink-0 ${isCursor ? "text-cursor-line-nr" : "text-line-nr"}`}
                    style={{ minWidth: `${gutterWidth}ch` }}
                  >
                    {getLineNumber(i, cursor)}
                  </span>
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
                  {task.label && (
                    <span className="text-xs text-muted-foreground shrink-0 flex gap-1">
                      {task.label.split(",").map((l) => (
                        <span key={l.trim()}>[{l.trim()}]</span>
                      ))}
                    </span>
                  )}
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
        tasks={filtered}
        onSelectTask={(t) => setSelectedTask(t as RankedTask)}
      />
    </div>
  );
}
