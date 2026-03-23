"use client";

import { Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  completeTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { TaskDetail } from "@/components/task-detail";
import { Input } from "@/components/ui/input";
import type { TaskStatus } from "@/core/types";

import type { RankedTask } from "@/core/urgency";
import { useKeyboard } from "@/hooks/use-keyboard";
import { formatDate } from "@/lib/utils";

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

function InlineEdit({
  value,
  onSave,
  className,
  type = "text",
  suggestions,
  prefix,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  type?: "text" | "date";
  suggestions?: string[];
  prefix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = suggestions?.filter(
    (s) => s.toLowerCase().includes(draft.toLowerCase()) && s !== draft,
  );

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setShowSuggestions(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editing, value]);

  if (!editing) {
    return (
      <button
        type="button"
        className={className}
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        {type === "date" && value
          ? formatDate(new Date(value))
          : value
            ? `${prefix ? `${prefix} ` : ""}${value}`
            : "\u00a0"}
      </button>
    );
  }

  function commit() {
    setEditing(false);
    setShowSuggestions(false);
    if (draft !== value) onSave(draft);
  }

  return (
    <span
      className="relative"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="listbox"
    >
      <Input
        ref={inputRef}
        type={type}
        value={type === "date" && draft ? draft.slice(0, 10) : draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (suggestions) setShowSuggestions(true);
        }}
        onBlur={() => setTimeout(commit, 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
          e.stopPropagation();
        }}
        className={`h-auto py-0 px-1 text-inherit border-0 border-b border-border bg-transparent focus-visible:ring-0 ${className ?? ""}`}
      />
      {showSuggestions && filtered && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-border bg-popover py-1">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              className="w-full px-2 py-1 text-xs text-left hover:bg-accent transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                setDraft(s);
                setShowSuggestions(false);
                setEditing(false);
                if (s !== value) onSave(s);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

export function QueueView({
  tasks,
  categories,
  defaultCategory,
}: {
  tasks: RankedTask[];
  categories?: string[];
  defaultCategory?: string;
}) {
  const [selectedTask, setSelectedTask] = useState<RankedTask | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const { cursor, setCursor, selectedIds, toggleSelect, pendingDelete } =
    useKeyboard({
      tasks,
      onComplete: (ids) => {
        for (const id of ids) completeTaskAction(id);
      },
      onDelete: (ids) => {
        for (const id of ids) deleteTaskAction(id);
        if (selectedTask && ids.includes(selectedTask.id))
          setSelectedTask(null);
      },
      onCreate: () => setCreateOpen(true),
      onSelect: (task) => setSelectedTask(task as RankedTask),
      onDeselect: () => setSelectedTask(null),
      onHelp: () => window.dispatchEvent(new Event("open-keymap-help")),
    });

  useEffect(() => {
    if (cursor >= 0 && cursor < tasks.length) {
      const el = rowRefs.current.get(tasks[cursor].id);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [cursor, tasks]);

  function handleRowClick(task: RankedTask, idx: number, e: React.MouseEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      toggleSelect(task.id);
      return;
    }
    setCursor(idx);
  }

  return (
    <div className="flex flex-col h-full">
      {pendingDelete && (
        <div className="flex items-center gap-2 px-6 py-1.5 bg-destructive/10 text-xs text-destructive border-b border-destructive/20">
          <span>
            delete {pendingDelete.length} task
            {pendingDelete.length > 1 ? "s" : ""}? y/N
          </span>
        </div>
      )}
      <div className="flex-1 overflow-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16">
            <Zap className="size-10 opacity-40" />
            <p className="text-sm">Nothing urgent</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {tasks.map((task, i) => {
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
                  className={`flex w-full items-center gap-3 px-6 py-2.5 cursor-pointer transition-colors text-left select-none ${bg}`}
                  onClick={(e) => handleRowClick(task, i, e)}
                  onKeyDown={() => {}}
                  tabIndex={0}
                  role="row"
                >
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
                  <InlineEdit
                    value={task.description}
                    onSave={(v) =>
                      updateTaskAction(task.id, { description: v })
                    }
                    className={`flex-1 truncate text-sm text-left ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}
                  />
                  <InlineEdit
                    value={task.category ?? ""}
                    onSave={(v) =>
                      updateTaskAction(task.id, { category: v || null })
                    }
                    suggestions={categories}
                    prefix="#"
                    className="w-24 truncate text-xs text-muted-foreground text-right shrink-0"
                  />
                  <InlineEdit
                    value={task.due ?? ""}
                    type="date"
                    onSave={(v) =>
                      updateTaskAction(task.id, {
                        due: v ? new Date(`${v}T12:00:00`).toISOString() : null,
                      })
                    }
                    className="w-20 text-xs text-muted-foreground text-right tabular-nums shrink-0"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        categories={categories}
        defaultCategory={defaultCategory}
      />
      <TaskDetail
        task={selectedTask}
        open={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
        tasks={tasks}
        onSelectTask={(t) => setSelectedTask(t as RankedTask)}
      />
    </div>
  );
}
