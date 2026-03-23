"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { TaskDetail } from "@/components/task-detail";
import { Button } from "@/components/ui/button";
import type { Task } from "@/core/types";

type ViewMode = "week" | "month";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

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

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatWeekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const mOpts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  const start = monday.toLocaleDateString("en-US", mOpts);
  if (monday.getFullYear() !== sunday.getFullYear()) {
    const end = sunday.toLocaleDateString("en-US", {
      ...mOpts,
      year: "numeric",
    });
    return `${start}, ${monday.getFullYear()} \u2013 ${end}`;
  }
  if (monday.getMonth() !== sunday.getMonth()) {
    const end = sunday.toLocaleDateString("en-US", mOpts);
    return `${start} \u2013 ${end}, ${monday.getFullYear()}`;
  }
  return `${start} \u2013 ${sunday.getDate()}, ${monday.getFullYear()}`;
}

function formatMonthTitle(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

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

function statusColor(task: Task): string {
  if (task.status === "done") return "text-status-done line-through";
  if (task.status === "blocked") return "text-status-blocked";
  if (task.status === "wip") return "text-status-wip";
  if (task.status === "cancelled") return "text-status-cancelled line-through";
  return "text-foreground";
}

function statusDot(task: Task): string {
  if (task.status === "done") return "bg-status-done";
  if (task.status === "blocked") return "bg-status-blocked";
  if (task.status === "wip") return "bg-status-wip";
  if (task.status === "cancelled") return "bg-status-cancelled";
  return "bg-status-pending";
}

export function CalendarView({ tasks }: { tasks: Task[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string>("");
  const pendingBracket = useRef<"[" | "]" | null>(null);
  const bracketTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const weekMonday = useMemo(() => getMondayOfWeek(anchor), [anchor]);
  const monthStart = useMemo(() => startOfMonth(anchor), [anchor]);

  function handleDayClick(date: Date) {
    const iso = `${formatDateKey(date)}T12:00`;
    setCreateDate(iso);
    setCreateOpen(true);
  }

  const prevWeek = useCallback(() => {
    setAnchor((d) => addDays(d, -7));
  }, []);
  const nextWeek = useCallback(() => {
    setAnchor((d) => addDays(d, 7));
  }, []);
  const prevMonth = useCallback(() => {
    setAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, d.getDate()));
  }, []);
  const nextMonth = useCallback(() => {
    setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  }, []);
  const goToday = useCallback(() => {
    setAnchor(new Date());
  }, []);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (pendingBracket.current) {
        const bracket = pendingBracket.current;
        pendingBracket.current = null;
        if (bracketTimer.current) {
          clearTimeout(bracketTimer.current);
          bracketTimer.current = null;
        }

        if (e.key === "w") {
          e.preventDefault();
          if (bracket === "[") prevWeek();
          else nextWeek();
          return;
        }
        if (e.key === "m") {
          e.preventDefault();
          if (bracket === "[") prevMonth();
          else nextMonth();
          return;
        }
        return;
      }

      if (e.key === "[" || e.key === "]") {
        e.preventDefault();
        pendingBracket.current = e.key;
        bracketTimer.current = setTimeout(() => {
          pendingBracket.current = null;
          bracketTimer.current = null;
        }, 500);
        return;
      }

      if (e.key === "w") {
        e.preventDefault();
        setViewMode("week");
        return;
      }
      if (e.key === "m") {
        e.preventDefault();
        setViewMode("month");
        return;
      }
      if (e.key === "t") {
        e.preventDefault();
        goToday();
        return;
      }
    },
    [prevWeek, nextWeek, prevMonth, nextMonth, goToday],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  useEffect(() => {
    return () => {
      if (bracketTimer.current) clearTimeout(bracketTimer.current);
    };
  }, []);

  const headerTitle =
    viewMode === "week"
      ? formatWeekRange(weekMonday)
      : formatMonthTitle(monthStart);

  function handlePrev() {
    if (viewMode === "week") prevWeek();
    else prevMonth();
  }
  function handleNext() {
    if (viewMode === "week") nextWeek();
    else nextMonth();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrev}
            className="hover:bg-accent"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={goToday}
            className="hover:bg-accent text-xs font-medium"
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            className="hover:bg-accent"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{headerTitle}</h2>
        <div className="flex items-center gap-1 rounded-md border border-border/60 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              viewMode === "week"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => setViewMode("month")}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              viewMode === "month"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {viewMode === "week" ? (
        <WeekView
          monday={weekMonday}
          today={today}
          tasksByDate={tasksByDate}
          onDayClick={handleDayClick}
          onTaskClick={setSelectedTask}
        />
      ) : (
        <MonthView
          monthStart={monthStart}
          today={today}
          tasksByDate={tasksByDate}
          onDayClick={handleDayClick}
          onTaskClick={setSelectedTask}
        />
      )}

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

function WeekView({
  monday,
  today,
  tasksByDate,
  onDayClick,
  onTaskClick,
}: {
  monday: Date;
  today: Date;
  tasksByDate: Map<string, Task[]>;
  onDayClick: (date: Date) => void;
  onTaskClick: (task: Task) => void;
}) {
  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < 7; i++) {
      result.push(addDays(monday, i));
    }
    return result;
  }, [monday]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border/60 shrink-0">
        {days.map((date, idx) => {
          const isToday = isSameDay(date, today);
          return (
            <div
              key={formatDateKey(date)}
              className={`flex flex-col items-center py-2 ${isToday ? "bg-primary/5" : ""}`}
            >
              <span className="text-xs text-muted-foreground">
                {DAY_NAMES[idx]}
              </span>
              <span
                className={`text-sm font-semibold mt-0.5 ${
                  isToday
                    ? "bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center"
                    : "text-foreground"
                }`}
              >
                {date.getDate()}
              </span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-7 flex-1 overflow-auto">
        {days.map((date) => {
          const key = formatDateKey(date);
          const dayTasks = tasksByDate.get(key) ?? [];
          const isToday = isSameDay(date, today);

          return (
            <div
              key={key}
              className={`flex flex-col p-2 border-r border-border/30 ${
                isToday ? "bg-primary/5" : ""
              }`}
            >
              <div className="flex flex-col gap-1 w-full">
                {dayTasks.map((task) => (
                  <button
                    type="button"
                    key={task.id}
                    className={`flex items-start gap-1.5 text-xs leading-snug px-1.5 py-1 rounded transition-colors hover:bg-accent w-full text-left ${statusColor(task)}`}
                    onClick={() => onTaskClick(task)}
                  >
                    <span
                      className={`shrink-0 mt-1 w-1.5 h-1.5 rounded-full ${statusDot(task)}`}
                    />
                    <span className="truncate">{task.description}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="flex-1 min-h-[2rem] w-full hover:bg-accent/30 rounded transition-colors cursor-pointer"
                onClick={() => onDayClick(date)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({
  monthStart,
  today,
  tasksByDate,
  onDayClick,
  onTaskClick,
}: {
  monthStart: Date;
  today: Date;
  tasksByDate: Map<string, Task[]>;
  onDayClick: (date: Date) => void;
  onTaskClick: (task: Task) => void;
}) {
  const totalDays = daysInMonth(monthStart);
  const offset = mondayOffset(monthStart);

  const cells = useMemo(() => {
    const result: { key: string; day: number | null }[] = [];
    for (let i = 0; i < offset; i++)
      result.push({ key: `pre-${i}`, day: null });
    for (let d = 1; d <= totalDays; d++) result.push({ key: `d-${d}`, day: d });
    while (result.length % 7 !== 0)
      result.push({ key: `post-${result.length}`, day: null });
    return result;
  }, [offset, totalDays]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
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
      <div className="grid grid-cols-7 flex-1 auto-rows-fr overflow-auto">
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
            monthStart.getFullYear(),
            monthStart.getMonth(),
            day,
          );
          const dateKey = formatDateKey(cellDate);
          const dayTasks = tasksByDate.get(dateKey) ?? [];
          const isToday = isSameDay(cellDate, today);
          const isPast = cellDate < today && !isToday;
          const hasOverdue = dayTasks.some(
            (t) =>
              t.status !== "done" &&
              t.status !== "cancelled" &&
              t.due &&
              new Date(t.due) < today,
          );
          const hasHigh = dayTasks.some(
            (t) =>
              t.status !== "done" &&
              t.status !== "cancelled" &&
              (t.priority ?? 0) >= 3,
          );

          let dayBg = "";
          if (hasOverdue) dayBg = "bg-status-blocked/8";
          else if (hasHigh) dayBg = "bg-status-wip/8";
          else if (dayTasks.length > 0) dayBg = "bg-primary/5";

          return (
            <div
              key={cell.key}
              className={`flex flex-col p-1.5 text-left transition-colors border-b border-r border-border/30 ${dayBg} ${
                isToday ? "ring-1 ring-primary/50" : ""
              } ${isPast ? "opacity-50" : ""}`}
            >
              <span
                className={`text-xs font-medium mb-1 ${
                  isToday ? "text-primary font-bold" : "text-muted-foreground"
                }`}
              >
                {day}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden w-full">
                {dayTasks.slice(0, 3).map((task) => (
                  <button
                    type="button"
                    key={task.id}
                    className={`text-[10px] leading-tight truncate max-w-full px-1 py-0.5 rounded transition-colors hover:bg-accent w-full text-left block ${statusColor(task)}`}
                    onClick={() => onTaskClick(task)}
                  >
                    {task.description}
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1">
                    +{dayTasks.length - 3}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="flex-1 min-h-[1rem] w-full hover:bg-accent/50 rounded transition-colors cursor-pointer"
                onClick={() => onDayClick(cellDate)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
