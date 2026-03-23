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
import { Checkbox } from "@/components/ui/checkbox";
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

function urgencyColor(score: number): string {
  if (score >= 20) return "text-status-blocked";
  if (score >= 10) return "text-status-wip";
  return "text-muted-foreground";
}

function urgencyBg(score: number): string {
  if (score >= 20) return "bg-status-blocked/10";
  if (score >= 10) return "bg-status-wip/10";
  return "";
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

  const { cursor, setCursor, selectedIds, toggleSelect } = useKeyboard({
    tasks,
    onComplete: (ids) => {
      for (const id of ids) completeTaskAction(id);
    },
    onDelete: (ids) => {
      for (const id of ids) deleteTaskAction(id);
      if (selectedTask && ids.includes(selectedTask.id)) setSelectedTask(null);
    },
    onCreate: () => setCreateOpen(true),
    onSelect: (task) => setSelectedTask(task as RankedTask),
    onDeselect: () => setSelectedTask(null),
  });

  useEffect(() => {
    if (cursor >= 0 && cursor < tasks.length) {
      const el = rowRefs.current.get(tasks[cursor].id);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [cursor, tasks]);

  async function handleToggle(task: RankedTask) {
    if (task.status === "done") {
      await updateTaskAction(task.id, { status: "pending" });
    } else {
      await completeTaskAction(task.id);
    }
  }

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

              let bg = `${urgencyBg(task.urgency)} hover:bg-accent/50`;
              if (isSelected) bg = "bg-primary/10";
              else if (isCursor) bg = "bg-accent";

              return (
                <div
                  key={task.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(task.id, el);
                  }}
                  className={`flex w-full items-center gap-3 px-6 py-3 cursor-pointer transition-colors text-left select-none ${bg}`}
                  onClick={(e) => handleRowClick(task, i, e)}
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
                  <span
                    className={`w-16 text-xs shrink-0 ${STATUS_COLOR[task.status as TaskStatus]}`}
                  >
                    {STATUS_LABEL[task.status as TaskStatus]}
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
                  <span
                    className={`w-12 text-xs font-semibold tabular-nums text-center shrink-0 ${urgencyColor(task.urgency)}`}
                  >
                    {task.urgency}
                  </span>
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
