"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { completeTaskAction, updateTaskAction } from "@/app/actions/tasks";
import { TiptapEditor } from "@/components/tiptap-editor";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Task, TaskStatus } from "@/core/types";
import { TASK_STATUSES } from "@/core/types";
import { formatDate, isInputFocused } from "@/lib/utils";

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  wip: "In Progress",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<string, string> = {
  "0": "\u2014",
  "1": "!",
  "2": "!!",
  "3": "!!!",
};

export function TaskDetail({
  task,
  open,
  onClose,
  tasks,
  onSelectTask,
}: {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  tasks?: Task[];
  onSelectTask?: (task: Task) => void;
}) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [label, setLabel] = useState("");
  const [priority, setPriority] = useState("0");
  const [due, setDue] = useState("");
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const notesRef = useRef<string | null>(null);

  const allCategories = useMemo(() => {
    if (!tasks) return [];
    const cats = new Set<string>();
    for (const t of tasks) {
      if (t.category) cats.add(t.category);
    }
    return [...cats].sort();
  }, [tasks]);

  const filteredCategories = useMemo(() => {
    if (!category) return allCategories;
    const lower = category.toLowerCase();
    return allCategories.filter(
      (c) => c.toLowerCase().includes(lower) && c !== category,
    );
  }, [allCategories, category]);

  useEffect(() => {
    if (task) {
      setDescription(task.description);
      setCategory(task.category ?? "");
      setLabel(task.label ?? "");
      setPriority(String(task.priority ?? 0));
      setDue(task.due ? task.due.slice(0, 16) : "");
      notesRef.current = task.notes ?? null;
    }
  }, [task]);

  const handleSave = useCallback(async () => {
    if (!task) return;
    await updateTaskAction(task.id, {
      description,
      category: category || null,
      label: label || null,
      priority: Number(priority),
      due: due ? new Date(due).toISOString() : null,
      notes: notesRef.current || null,
    });
  }, [task, description, category, label, priority, due]);

  const handleClose = useCallback(async () => {
    await handleSave();
    onClose();
  }, [handleSave, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
        return;
      }

      if (!tasks || !onSelectTask || !task) return;
      if (isInputFocused()) return;

      if (e.key === "j" || e.key === "k") {
        e.preventDefault();
        handleSave();
        const idx = tasks.findIndex((t) => t.id === task.id);
        if (idx === -1) return;
        const next = e.key === "j" ? idx + 1 : idx - 1;
        if (next >= 0 && next < tasks.length) {
          onSelectTask(tasks[next]);
        }
      }
    },
    [task, tasks, onSelectTask, handleSave],
  );

  if (!task) return null;

  async function handleStatusChange(status: string) {
    if (!task) return;
    if (status === "done") {
      await completeTaskAction(task.id);
    } else {
      await updateTaskAction(task.id, { status: status as TaskStatus });
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className="fixed inset-4 sm:inset-8 z-50 mx-auto max-w-3xl flex flex-col border border-border bg-card duration-150 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.97] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.97]"
          onKeyDown={handleKeyDown}
        >
          <div className="px-6 pt-4 pb-2">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-lg font-medium bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
              placeholder="Task description"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 px-6 pb-2 border-b border-border/40">
            <div className="relative">
              <Input
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setShowCategorySuggestions(true);
                }}
                onFocus={() => setShowCategorySuggestions(true)}
                onBlur={() =>
                  setTimeout(() => setShowCategorySuggestions(false), 150)
                }
                placeholder="# category"
                className="h-8 w-28 text-xs"
              />
              {showCategorySuggestions && filteredCategories.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-border bg-popover py-1">
                  {filteredCategories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="w-full px-2 py-1 text-xs text-left hover:bg-accent transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setCategory(c);
                        setShowCategorySuggestions(false);
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Select
              value={task.status}
              onValueChange={(v) => v && handleStatusChange(v)}
            >
              <SelectTrigger size="sm" className="w-auto gap-1">
                <SelectValue>
                  {STATUS_LABELS[task.status as TaskStatus]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priority} onValueChange={(v) => v && setPriority(v)}>
              <SelectTrigger size="sm" className="w-auto gap-1">
                <SelectValue>{PRIORITY_LABELS[priority]}</SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                <SelectItem value="0">{"\u2014"} None</SelectItem>
                <SelectItem value="1">! Low</SelectItem>
                <SelectItem value="2">!! Medium</SelectItem>
                <SelectItem value="3">!!! High</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="h-8 w-auto text-xs"
            />

            <div className="flex-1" />

            {task.createdAt && (
              <span className="text-xs text-muted-foreground/60 tabular-nums">
                {formatDate(new Date(task.createdAt))}
              </span>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-auto px-6 pt-3 pb-6">
            <TiptapEditor
              content={task.notes ?? null}
              onChange={(json) => {
                notesRef.current = json;
              }}
            />
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
