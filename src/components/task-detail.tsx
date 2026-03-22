"use client";

import { useEffect, useState } from "react";
import {
  completeTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { StatusBadge } from "@/components/status-badge";
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
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Task, TaskStatus } from "@/core/types";
import { TASK_STATUSES } from "@/core/types";

export function TaskDetail({
  task,
  open,
  onClose,
}: {
  task: Task | null;
  open: boolean;
  onClose: () => void;
}) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("0");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (task) {
      setDescription(task.description);
      setCategory(task.category ?? "");
      setPriority(String(task.priority ?? 0));
      setDue(task.due ? task.due.slice(0, 16) : "");
      setNotes(task.notes ?? "");
    }
  }, [task]);

  if (!task) return null;

  async function handleSave() {
    if (!task) return;
    await updateTaskAction(task.id, {
      description,
      category: category || null,
      priority: Number(priority),
      due: due ? new Date(due).toISOString() : null,
      notes: notes || null,
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
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[400px] sm:w-[480px] flex flex-col">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle className="flex-1 text-base">
              Task #{task.id}
            </SheetTitle>
            <StatusBadge status={task.status as TaskStatus} />
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-auto py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="detail-description">Description</Label>
            <Input
              id="detail-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Status</Label>
            <Select
              value={task.status}
              onValueChange={(v) => v && handleStatusChange(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="detail-category">Category</Label>
              <Input
                id="detail-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => v && setPriority(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">None</SelectItem>
                  <SelectItem value="1">Low</SelectItem>
                  <SelectItem value="2">Medium</SelectItem>
                  <SelectItem value="3">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="detail-due">Due Date</Label>
            <Input
              id="detail-due"
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </div>
          <Separator className="bg-border/60" />
          <div className="flex flex-col gap-2">
            <Label htmlFor="detail-notes">Notes</Label>
            <textarea
              id="detail-notes"
              className="min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes\u2026"
            />
          </div>
          {task.createdAt && (
            <p className="text-xs text-muted-foreground tabular-nums">
              Created {new Date(task.createdAt).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2 pt-4 border-t border-border/60">
          <Button onClick={handleSave} className="flex-1">
            Save
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
