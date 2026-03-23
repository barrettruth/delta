"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CreateTaskDialog } from "@/components/create-task-dialog";
import { TaskDetail } from "@/components/task-detail";
import { Button } from "@/components/ui/button";
import type { Task } from "@/core/types";
import { blendColors, isInputFocused } from "@/lib/utils";

type ViewMode = "week" | "month";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
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

function weekOffset(date: Date): number {
  return date.getDay();
}

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const mOpts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  const start = weekStart.toLocaleDateString("en-US", mOpts);
  if (weekStart.getFullYear() !== weekEnd.getFullYear()) {
    const end = weekEnd.toLocaleDateString("en-US", {
      ...mOpts,
      year: "numeric",
    });
    return `${start}, ${weekStart.getFullYear()} \u2013 ${end}`;
  }
  if (weekStart.getMonth() !== weekEnd.getMonth()) {
    const end = weekEnd.toLocaleDateString("en-US", mOpts);
    return `${start} \u2013 ${end}, ${weekStart.getFullYear()}`;
  }
  return `${start} \u2013 ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
}

function formatMonthTitle(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function statusColor(task: Task): string {
  if (task.status === "done") return "text-status-done line-through";
  if (task.status === "blocked") return "text-status-blocked";
  if (task.status === "wip") return "text-status-wip";
  if (task.status === "cancelled") return "text-status-cancelled line-through";
  return "text-foreground";
}

function dayBlendStyle(
  tasks: Task[],
  colors: Record<string, string>,
): React.CSSProperties | undefined {
  const hexes = tasks
    .map((t) => (t.category ? colors[t.category] : undefined))
    .filter((c): c is string => !!c);
  const blended = blendColors(hexes);
  if (!blended) return undefined;
  return { backgroundColor: `${blended}18` };
}

function statusDot(task: Task): string {
  if (task.status === "done") return "bg-status-done";
  if (task.status === "blocked") return "bg-status-blocked";
  if (task.status === "wip") return "bg-status-wip";
  if (task.status === "cancelled") return "bg-status-cancelled";
  return "bg-status-pending";
}

export function CalendarView({
  tasks,
  categories,
  defaultCategory,
  categoryColors = {},
}: {
  tasks: Task[];
  categories?: string[];
  defaultCategory?: string;
  categoryColors?: Record<string, string>;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string>("");
  const pendingBracket = useRef<"[" | "]" | null>(null);
  const bracketTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    const now = new Date();
    const msUntilMidnight =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() -
      now.getTime();
    const timer = setTimeout(() => setToday(new Date()), msUntilMidnight + 100);
    return () => clearTimeout(timer);
  }, []);

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

  const weekAnchor = useMemo(() => getWeekStart(anchor), [anchor]);
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
      ? formatWeekRange(weekAnchor)
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
        <div className="flex items-center gap-1 border border-border/60 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
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
            className={`px-3 py-1 text-xs font-medium transition-colors ${
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
          weekStart={weekAnchor}
          today={today}
          tasksByDate={tasksByDate}
          onDayClick={handleDayClick}
          onTaskClick={setSelectedTask}
          dayNames={DAY_NAMES}
          categoryColors={categoryColors}
        />
      ) : (
        <MonthView
          monthStart={monthStart}
          today={today}
          tasksByDate={tasksByDate}
          onDayClick={handleDayClick}
          onTaskClick={setSelectedTask}
          dayNames={DAY_NAMES}
          categoryColors={categoryColors}
        />
      )}

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultDue={createDate}
        categories={categories}
        defaultCategory={defaultCategory}
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
  weekStart,
  today,
  tasksByDate,
  onDayClick,
  onTaskClick,
  dayNames,
  categoryColors,
}: {
  weekStart: Date;
  today: Date;
  tasksByDate: Map<string, Task[]>;
  onDayClick: (date: Date) => void;
  onTaskClick: (task: Task) => void;
  dayNames: string[];
  categoryColors: Record<string, string>;
}) {
  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < 7; i++) {
      result.push(addDays(weekStart, i));
    }
    return result;
  }, [weekStart]);

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
                {dayNames[idx]}
              </span>
              <span
                className={`text-sm font-semibold mt-0.5 ${
                  isToday
                    ? "bg-primary text-primary-foreground w-7 h-7 flex items-center justify-center"
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

          const blend = dayBlendStyle(dayTasks, categoryColors);
          return (
            <div
              key={key}
              className={`flex flex-col p-2 border-r border-border/30 ${
                isToday ? "bg-primary/5" : ""
              }`}
              style={!isToday ? blend : undefined}
            >
              <div className="flex flex-col gap-1 w-full">
                {dayTasks.map((task) => (
                  <button
                    type="button"
                    key={task.id}
                    className={`flex items-start gap-1.5 text-xs leading-snug px-1.5 py-1 transition-colors hover:bg-accent w-full text-left ${statusColor(task)}`}
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
                className="flex-1 min-h-[2rem] w-full hover:bg-accent/30 transition-colors cursor-pointer"
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
  dayNames,
  categoryColors,
}: {
  monthStart: Date;
  today: Date;
  tasksByDate: Map<string, Task[]>;
  onDayClick: (date: Date) => void;
  onTaskClick: (task: Task) => void;
  dayNames: string[];
  categoryColors: Record<string, string>;
}) {
  const totalDays = daysInMonth(monthStart);
  const offset = weekOffset(monthStart);

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
        {dayNames.map((d) => (
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
          const blend = dayBlendStyle(dayTasks, categoryColors);

          return (
            <div
              key={cell.key}
              className={`flex flex-col p-1.5 text-left transition-colors border-b border-r border-border/30 ${
                isToday ? "ring-1 ring-primary/50" : ""
              } ${isPast ? "opacity-50" : ""}`}
              style={blend}
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
                    className={`flex items-start gap-1 text-[10px] leading-tight max-w-full px-1 py-0.5 transition-colors hover:bg-accent w-full text-left ${statusColor(task)}`}
                    onClick={() => onTaskClick(task)}
                  >
                    <span
                      className={`shrink-0 mt-[3px] w-1.5 h-1.5 rounded-full ${statusDot(task)}`}
                    />
                    <span className="truncate">{task.description}</span>
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
                className="flex-1 min-h-[1rem] w-full hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => onDayClick(cellDate)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
