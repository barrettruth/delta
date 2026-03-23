"use client";

import { Circle, CircleCheck, Clock, Loader2, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { completeTaskAction, updateTaskAction } from "@/app/actions/tasks";
import { StatusBadge } from "@/components/status-badge";
import { TaskDetail } from "@/components/task-detail";
import { Checkbox } from "@/components/ui/checkbox";
import type { TaskStatus } from "@/core/types";
import type { RankedTask } from "@/core/urgency";

const statusIcon: Record<TaskStatus, React.ReactNode> = {
  pending: <Circle className="size-4 text-status-pending" />,
  wip: <Loader2 className="size-4 text-status-wip" />,
  done: <CircleCheck className="size-4 text-status-done" />,
  blocked: <Clock className="size-4 text-status-blocked" />,
  cancelled: <Trash2 className="size-4 text-status-cancelled" />,
};

function urgencyColor(score: number): string {
  if (score >= 20) return "text-status-blocked";
  if (score >= 10) return "text-status-wip";
  return "text-muted-foreground";
}

function urgencyBg(score: number): string {
  if (score >= 20) return "bg-status-blocked/10";
  if (score >= 10) return "bg-status-wip/10";
  return "bg-muted/50";
}

export function QueueView({ tasks }: { tasks: RankedTask[] }) {
  const [selectedTask, setSelectedTask] = useState<RankedTask | null>(null);

  async function handleToggle(task: RankedTask) {
    if (task.status === "done") {
      await updateTaskAction(task.id, { status: "pending" });
    } else {
      await completeTaskAction(task.id);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Zap className="size-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Queue</h1>
          <span className="text-xs text-muted-foreground">
            {tasks.length} tasks ranked by urgency
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16">
            <Zap className="size-10 opacity-40" />
            <p className="text-sm">Nothing urgent</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {tasks.map((task, i) => (
              <button
                type="button"
                key={task.id}
                className="flex w-full items-center gap-3 px-6 py-3 cursor-pointer transition-colors text-left hover:bg-accent/50"
                onClick={() => setSelectedTask(task)}
              >
                <span className="text-xs text-muted-foreground tabular-nums w-5 shrink-0 text-right">
                  {i + 1}
                </span>
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
                <span
                  className={`w-10 text-xs font-mono font-semibold tabular-nums text-right shrink-0 ${urgencyColor(task.urgency)}`}
                >
                  {task.urgency}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <TaskDetail
        task={selectedTask}
        open={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}
