"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  completeTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { TiptapEditor } from "@/components/tiptap-editor";
import { Button } from "@/components/ui/button";
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
  "0": "—",
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
  const [priority, setPriority] = useState("0");
  const [due, setDue] = useState("");
  const notesRef = useRef<string | null>(null);

  useEffect(() => {
    if (task) {
      setDescription(task.description);
      setCategory(task.category ?? "");
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
      priority: Number(priority),
      due: due ? new Date(due).toISOString() : null,
      notes: notesRef.current || null,
    });
    onClose();
  }, [task, description, category, priority, due, onClose]);

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
    onClose();
  }

  async function handleDelete() {
    if (!task) return;
    await deleteTaskAction(task.id);
    onClose();
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className="fixed inset-4 sm:inset-8 z-50 mx-auto max-w-3xl flex flex-col border border-border bg-card duration-150 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.97] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.97]"
          onKeyDown={handleKeyDown}
        >
          <div className="px-6 pt-6 pb-3">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-lg font-medium bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
              placeholder="Task description"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 px-6 pb-3 border-b border-border/40">
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
                <SelectItem value="0">— None</SelectItem>
                <SelectItem value="1">! Low</SelectItem>
                <SelectItem value="2">!! Medium</SelectItem>
                <SelectItem value="3">!!! High</SelectItem>
              </SelectContent>
            </Select>

            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="category"
              className="h-7 w-28 text-xs"
            />

            <Input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="h-7 w-auto text-xs"
            />

            <div className="flex-1" />

            {task.createdAt && (
              <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                {formatDate(new Date(task.createdAt))}
              </span>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-auto p-6">
            <TiptapEditor
              content={task.notes ?? null}
              onChange={(json) => {
                notesRef.current = json;
              }}
            />
          </div>

          <div className="flex items-center gap-2 px-6 py-3 border-t border-border/40">
            <Button size="sm" onClick={handleSave}>
              Save
            </Button>
            <span className="text-[10px] text-muted-foreground">Ctrl+S</span>
            <div className="flex-1" />
            <Button size="sm" variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
