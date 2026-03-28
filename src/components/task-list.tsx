"use client";

import { Circle, CircleCheck, Clock, Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  completeTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { RecurrenceStrategyDialog } from "@/components/recurrence-strategy-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigation } from "@/contexts/navigation";
import { useTaskPanel } from "@/contexts/task-panel";
import type { Task, TaskStatus } from "@/core/types";
import { useKeyboard } from "@/hooks/use-keyboard";
import { useRecurrenceDelete } from "@/hooks/use-recurrence-delete";
import { formatDate } from "@/lib/utils";

const statusIcon: Record<TaskStatus, React.ReactNode> = {
  pending: <Circle className="size-4 text-status-pending" />,
  wip: <Loader2 className="size-4 text-status-wip" />,
  done: <CircleCheck className="size-4 text-status-done" />,
  blocked: <Clock className="size-4 text-status-blocked" />,
  cancelled: <Trash2 className="size-4 text-status-cancelled" />,
};

export function TaskList({ tasks }: { tasks: Task[] }) {
  const nav = useNavigation();
  const panel = useTaskPanel();
  const recurrenceDelete = useRecurrenceDelete();
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  const { cursor } = useKeyboard({
    tasks,
    onComplete: (ids) => {
      for (const id of ids) completeTaskAction(id);
    },
    onDelete: (ids) => {
      if (ids.length === 1) {
        const task = tasks.find((t) => t.id === ids[0]);
        if (task?.recurrence && recurrenceDelete.requestDelete(task)) return;
      }
      for (const id of ids) deleteTaskAction(id);
      if (panel.taskId && ids.includes(panel.taskId)) panel.close();
    },
    onStatusChange: (ids, status) => {
      for (const id of ids) updateTaskAction(id, { status });
    },
    onSelect: (task) => {
      nav.pushJump();
      panel.toggle(task.id);
    },
    onDeselect: () => panel.close(),
    onJump: () => nav.pushJump(),
  });

  useEffect(() => {
    if (cursor >= 0 && cursor < tasks.length) {
      const el = rowRefs.current.get(tasks[cursor].id);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [cursor, tasks]);

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

  async function handleToggle(task: Task) {
    if (task.status === "done") {
      await updateTaskAction(task.id, { status: "pending" });
    } else {
      await completeTaskAction(task.id);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {tasks.length === 0 ? (
          <div className="h-full" />
        ) : (
          <div className="divide-y divide-border/60">
            {tasks.map((task, i) => (
              <div
                key={task.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(task.id, el);
                }}
                className={`flex w-full items-center gap-3 px-6 py-3 cursor-pointer transition-colors text-left ${
                  i === cursor ? "bg-accent" : "hover:bg-accent/50"
                }`}
                onClick={() => {
                  nav.pushJump();
                  panel.open(task.id);
                }}
                onKeyDown={() => {}}
                tabIndex={0}
                role="row"
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
                <span className="w-24 truncate text-xs text-muted-foreground text-right shrink-0">
                  {task.category && task.category !== "Todo"
                    ? task.category
                    : ""}
                </span>
                <span className="w-20 text-xs text-muted-foreground text-right tabular-nums shrink-0">
                  {task.due ? formatDate(new Date(task.due)) : ""}
                </span>
              </div>
            ))}
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
