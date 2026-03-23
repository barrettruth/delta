"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { TaskDetail } from "@/components/task-detail";
import { Button } from "@/components/ui/button";
import type { Task } from "@/core/types";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function mondayOffset(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function CalendarView({ tasks }: { tasks: Task[] }) {
  const [current, setCurrent] = useState(() => startOfMonth(new Date()));
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string>("");
  const today = useMemo(() => new Date(), []);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.due) continue;
      const key = task.due.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(task);
    }
    return map;
  }, [tasks]);

  const totalDays = daysInMonth(current);
  const offset = mondayOffset(startOfMonth(current));
  const cells: { key: string; day: number | null }[] = [];
  for (let i = 0; i < offset; i++) cells.push({ key: `pre-${i}`, day: null });
  for (let d = 1; d <= totalDays; d++) cells.push({ key: `d-${d}`, day: d });
  for (let i = cells.length; cells.length % 7 !== 0; i++)
    cells.push({ key: `post-${i}`, day: null });

  function prevMonth() {
    setCurrent(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrent(new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  function handleDayClick(day: number) {
    const date = new Date(current.getFullYear(), current.getMonth(), day);
    const iso = date.toISOString().slice(0, 16);
    setCreateDate(iso);
    setCreateOpen(true);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/60 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={prevMonth}
          className="hover:bg-accent"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="text-lg font-semibold tracking-tight">
          {formatMonth(current)}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={nextMonth}
          className="hover:bg-accent"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 border-b border-border/60 shrink-0">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="text-xs font-medium text-muted-foreground text-center py-2"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1 auto-rows-fr">
        {cells.map((cell) => {
          if (cell.day === null) {
            return (
              <div
                key={cell.key}
                className="border-b border-r border-border/30 bg-muted/10"
              />
            );
          }

          const day = cell.day;
          const cellDate = new Date(
            current.getFullYear(),
            current.getMonth(),
            day,
          );
          const dateKey = cellDate.toISOString().slice(0, 10);
          const dayTasks = tasksByDate.get(dateKey) ?? [];
          const isToday = isSameDay(cellDate, today);
          const isPast = cellDate < today && !isToday;

          return (
            <div
              key={cell.key}
              className={`flex flex-col p-1.5 text-left transition-colors border-b border-r border-border/30 hover:bg-accent/50 cursor-pointer ${
                isToday ? "bg-primary/5" : ""
              } ${isPast ? "opacity-50" : ""}`}
              onClick={() => handleDayClick(day)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleDayClick(day);
              }}
            >
              <span
                className={`text-xs font-medium mb-1 inline-flex items-center justify-center size-5 rounded-full ${
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {day}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden flex-1">
                {dayTasks.slice(0, 3).map((task) => (
                  <button
                    type="button"
                    key={task.id}
                    className={`text-xs truncate px-1 py-0.5 rounded transition-colors hover:bg-accent w-full text-left ${
                      task.status === "done"
                        ? "text-status-done line-through"
                        : task.status === "blocked"
                          ? "text-status-blocked"
                          : "text-foreground"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedTask(task);
                    }}
                  >
                    {task.description}
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-xs text-muted-foreground px-1">
                    +{dayTasks.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultDue={createDate}
      />
      <TaskDetail
        task={selectedTask}
        open={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}
