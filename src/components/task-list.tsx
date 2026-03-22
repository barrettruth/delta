"use client";

import {
  Circle,
  CircleCheck,
  Clock,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import {
  completeTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { StatusBadge } from "@/components/status-badge";
import { TaskDetail } from "@/components/task-detail";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Task, TaskStatus } from "@/core/types";

const statusIcon: Record<TaskStatus, React.ReactNode> = {
  pending: <Circle className="size-4 text-status-pending" />,
  wip: <Loader2 className="size-4 text-status-wip" />,
  done: <CircleCheck className="size-4 text-status-done" />,
  blocked: <Clock className="size-4 text-status-blocked" />,
  cancelled: <Trash2 className="size-4 text-status-cancelled" />,
};

function PriorityIndicator({ priority }: { priority: number | null }) {
  if (!priority || priority === 0) return null;
  return (
    <span className="text-xs font-medium text-primary">
      {"!".repeat(Math.min(priority, 3))}
    </span>
  );
}

export function TaskList({ tasks, title }: { tasks: Task[]; title?: string }) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  async function handleToggle(task: Task) {
    if (task.status === "done") {
      await updateTaskAction(task.id, { status: "pending" });
    } else {
      await completeTaskAction(task.id);
    }
  }

  async function handleDelete(id: number) {
    await deleteTaskAction(id);
    if (selectedTask?.id === id) setSelectedTask(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h1 className="text-lg font-semibold">{title ?? "Tasks"}</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-1" />
          New
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            No tasks
          </div>
        ) : (
          <div className="divide-y">
            {tasks.map((task) => (
              <button
                type="button"
                key={task.id}
                className="flex w-full items-center gap-3 px-6 py-3 hover:bg-accent/50 cursor-pointer transition-colors text-left"
                onClick={() => setSelectedTask(task)}
              >
                <Checkbox
                  checked={task.status === "done"}
                  onCheckedChange={() => handleToggle(task)}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0"
                />
                <span className="shrink-0">
                  {statusIcon[task.status as TaskStatus]}
                </span>
                <span
                  className={`flex-1 truncate ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}
                >
                  {task.description}
                </span>
                <PriorityIndicator priority={task.priority} />
                {task.category && task.category !== "Todo" && (
                  <span className="text-xs text-muted-foreground">
                    {task.category}
                  </span>
                )}
                <StatusBadge status={task.status as TaskStatus} />
                {task.due && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(task.due).toLocaleDateString()}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 size-7 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(task.id);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </button>
            ))}
          </div>
        )}
      </div>
      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
      <TaskDetail
        task={selectedTask}
        open={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}
