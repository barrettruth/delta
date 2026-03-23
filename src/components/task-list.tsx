"use client";

import {
  Circle,
  CircleCheck,
  Clock,
  Inbox,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
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
import { Input } from "@/components/ui/input";
import type { Task, TaskStatus } from "@/core/types";
import { useKeyboard } from "@/hooks/use-keyboard";

const statusIcon: Record<TaskStatus, React.ReactNode> = {
  pending: <Circle className="size-4 text-status-pending" />,
  wip: <Loader2 className="size-4 text-status-wip" />,
  done: <CircleCheck className="size-4 text-status-done" />,
  blocked: <Clock className="size-4 text-status-blocked" />,
  cancelled: <Trash2 className="size-4 text-status-cancelled" />,
};

const FILTER_STATUSES: TaskStatus[] = ["pending", "wip", "blocked", "done"];

function PriorityIndicator({ priority }: { priority: number | null }) {
  if (!priority || priority === 0) return null;
  return (
    <span className="text-xs font-semibold text-primary">
      {"!".repeat(Math.min(priority, 3))}
    </span>
  );
}

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function TaskList({ tasks, title }: { tasks: Task[]; title?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const activeStatuses = useMemo(() => {
    const raw = searchParams.get("status");
    if (!raw) return new Set<TaskStatus>();
    return new Set(raw.split(",") as TaskStatus[]);
  }, [searchParams]);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 200);

  const filteredTasks = useMemo(() => {
    if (!debouncedQuery) return tasks;
    const lower = debouncedQuery.toLowerCase();
    return tasks.filter((t) => t.description.toLowerCase().includes(lower));
  }, [tasks, debouncedQuery]);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const rowRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const searchRef = useRef<HTMLInputElement>(null);

  const { selectedIndex } = useKeyboard({
    tasks: filteredTasks,
    searchRef,
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
    if (selectedIndex >= 0 && selectedIndex < filteredTasks.length) {
      const el = rowRefs.current.get(filteredTasks[selectedIndex].id);
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, filteredTasks]);

  const toggleStatus = useCallback(
    (status: TaskStatus) => {
      const next = new Set(activeStatuses);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      const params = new URLSearchParams(searchParams.toString());
      if (next.size > 0) {
        params.set("status", [...next].join(","));
      } else {
        params.delete("status");
      }
      startTransition(() => {
        router.push(`?${params.toString()}`);
      });
    },
    [activeStatuses, searchParams, router],
  );

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setSearchQuery("");
      searchRef.current?.blur();
    }
  }

  async function handleToggle(task: Task) {
    if (task.status === "done") {
      await updateTaskAction(task.id, { status: "pending" });
    } else {
      await completeTaskAction(task.id);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
        <h1 className="text-lg font-semibold tracking-tight">
          {title ?? "Tasks"}
        </h1>
        <Button
          size="sm"
          onClick={() => setCreateOpen(true)}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          New
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-border/60">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search tasks..."
            className="pl-8 pr-8 h-7 text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                searchRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {FILTER_STATUSES.map((status) => (
            <Button
              key={status}
              size="xs"
              variant={activeStatuses.has(status) ? "secondary" : "ghost"}
              onClick={() => toggleStatus(status)}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16">
            <Inbox className="size-10 opacity-40" />
            <p className="text-sm">
              {debouncedQuery || activeStatuses.size > 0
                ? "No matching tasks"
                : "No tasks yet"}
            </p>
            {!debouncedQuery && activeStatuses.size === 0 && (
              <p className="text-xs">
                Press{" "}
                <kbd className="mx-0.5 px-1.5 py-0.5 rounded bg-muted border border-border/60 font-mono text-xs">
                  o
                </kbd>{" "}
                to create one
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {filteredTasks.map((task, i) => (
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
                {task.category && task.category !== "Todo" && (
                  <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50">
                    {task.category}
                  </span>
                )}
                <StatusBadge status={task.status as TaskStatus} />
                {task.due && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                    {new Date(task.due).toLocaleDateString()}
                  </span>
                )}
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
