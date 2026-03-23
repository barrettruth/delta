"use client";

import {
  Circle,
  CircleCheck,
  Clock,
  Inbox,
  Loader2,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  completeTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { StatusBadge } from "@/components/status-badge";
import { TaskDetail } from "@/components/task-detail";
import { Checkbox } from "@/components/ui/checkbox";
import type { Task, TaskStatus } from "@/core/types";
import { useKeyboard } from "@/hooks/use-keyboard";

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
    <span className="text-xs font-semibold text-primary">
      {"!".repeat(Math.min(priority, 3))}
    </span>
  );
}

export function TaskList({ tasks }: { tasks: Task[] }) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const rowRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const { selectedIndex } = useKeyboard({
    tasks,
    onComplete: (id) => completeTaskAction(id),
    onDelete: (id) => {
      deleteTaskAction(id);
      if (selectedTask?.id === id) setSelectedTask(null);
    },
    onCreate: () => setCreateOpen(true),
    onSelect: (task) => setSelectedTask(task),
    onDeselect: () => setSelectedTask(null),
  });

  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < tasks.length) {
      const el = rowRefs.current.get(tasks[selectedIndex].id);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, tasks]);

  async function handleToggle(task: Task) {
    if (task.status === "done") {
      await updateTaskAction(task.id, { status: "pending" });
    } else {
      await completeTaskAction(task.id);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16">
            <Inbox className="size-10 opacity-40" />
            <p className="text-sm">No tasks yet</p>
            <p className="text-xs">
              Press{" "}
              <kbd className="mx-0.5 px-1.5 py-0.5 rounded bg-muted border border-border/60 font-mono text-xs">
                o
              </kbd>{" "}
              to create one
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {tasks.map((task, i) => (
              <button
                type="button"
                key={task.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(task.id, el);
                }}
                className={`flex w-full items-center gap-3 px-6 py-3 cursor-pointer transition-colors text-left focus-visible:outline-none focus-visible:bg-accent ${
                  i === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
                }`}
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
                  className={`flex-1 truncate text-sm ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}
                >
                  {task.description}
                </span>
                <PriorityIndicator priority={task.priority} />
                <span className="w-24 truncate text-xs text-muted-foreground text-right shrink-0">
                  {task.category && task.category !== "Todo"
                    ? task.category
                    : ""}
                </span>
                <span className="w-16 shrink-0">
                  <StatusBadge status={task.status as TaskStatus} />
                </span>
                <span className="w-20 text-xs text-muted-foreground text-right tabular-nums shrink-0">
                  {task.due ? new Date(task.due).toLocaleDateString() : ""}
                </span>
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
