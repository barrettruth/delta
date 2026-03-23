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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Task, TaskStatus } from "@/core/types";
import { TASK_STATUSES } from "@/core/types";

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  wip: "In Progress",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

const PRIORITY_LABELS: Record<string, string> = {
  "0": "None",
  "1": "Low",
  "2": "Medium",
  "3": "High",
};

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (el as HTMLElement).isContentEditable
  );
}

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
    [task, tasks, onSelectTask],
  );

  if (!task) return null;

  async function handleSave() {
    if (!task) return;
    await updateTaskAction(task.id, {
      description,
      category: category || null,
      priority: Number(priority),
      due: due ? new Date(due).toISOString() : null,
      notes: notesRef.current || null,
    });
    onClose();
  }

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
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className="fixed inset-4 sm:inset-8 z-50 mx-auto max-w-3xl flex flex-col rounded-xl bg-card ring-1 ring-border/40 shadow-2xl duration-150 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.97] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.97]"
          onKeyDown={handleKeyDown}
        >
          <div className="px-8 pt-8 pb-4">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xl font-medium bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
              placeholder="Task description"
            />
          </div>

          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-auto px-8 pb-8">
              <TiptapEditor
                content={task.notes ?? null}
                onChange={(json) => {
                  notesRef.current = json;
                }}
              />
            </div>

            <div className="w-64 shrink-0 border-l border-border/40 px-6 py-2 overflow-auto flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select
                  value={task.status}
                  onValueChange={(v) => v && handleStatusChange(v)}
                >
                  <SelectTrigger size="sm">
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
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Priority
                </Label>
                <Select
                  value={priority}
                  onValueChange={(v) => v && setPriority(v)}
                >
                  <SelectTrigger size="sm">
                    <SelectValue>{PRIORITY_LABELS[priority]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectItem value="0">None</SelectItem>
                    <SelectItem value="1">Low</SelectItem>
                    <SelectItem value="2">Medium</SelectItem>
                    <SelectItem value="3">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Category
                </Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Due</Label>
                <Input
                  type="datetime-local"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              <div className="flex-1" />

              {task.createdAt && (
                <p className="text-[10px] text-muted-foreground/60 tabular-nums">
                  Created {new Date(task.createdAt).toLocaleDateString()}
                </p>
              )}

              <div className="flex flex-col gap-2 pt-2 border-t border-border/40">
                <Button size="sm" onClick={handleSave}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
