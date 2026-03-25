"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MonthGrid } from "@/components/calendar/month-grid";
import { WeekTimeGrid } from "@/components/calendar/week-time-grid";
import { TaskDetail } from "@/components/task-detail";
import { Button } from "@/components/ui/button";
import type { Task } from "@/core/types";
import {
  addDays,
  DAY_NAMES,
  formatDateKey,
  formatMonthTitle,
  formatWeekRange,
  getWeekStart,
  startOfMonth,
} from "@/lib/calendar-utils";
import { isInputFocused } from "@/lib/utils";

type ViewMode = "week" | "month";

export function CalendarView({
  tasks,
  categoryColors = {},
  categories: _categories = [],
}: {
  tasks: Task[];
  categoryColors?: Record<string, string>;
  categories?: string[];
}) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    () => new Date(),
  );
  const pendingBracket = useRef<"[" | "]" | null>(null);
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
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
      const dateSource = task.startAt || task.due;
      if (!dateSource) continue;
      const key = dateSource.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(task);
    }
    return map;
  }, [tasks]);

  const allDayTasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const isAllDay = task.allDay === 1 || (!task.startAt && task.due);
      if (!isAllDay) continue;
      const key = (task.due || task.startAt || "").slice(0, 10);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(task);
    }
    return map;
  }, [tasks]);

  const timedTasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.startAt || task.allDay === 1) continue;
      const key = task.startAt.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(task);
    }
    return map;
  }, [tasks]);

  const weekAnchor = useMemo(() => getWeekStart(anchor), [anchor]);
  const monthStart = useMemo(() => startOfMonth(anchor), [anchor]);

  function handleDayClick(date: Date, _anchorEl?: HTMLElement) {
    setSelectedDate(date);
    setAnchor(date);
  }

  function handleSlotClick(
    date: Date,
    _minuteOfDay: number,
    _anchorEl: HTMLElement,
  ) {
    setSelectedDate(date);
    setAnchor(date);
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

  const moveSelection = useCallback((days: number) => {
    setSelectedDate((prev) => {
      const base = prev ?? new Date();
      const next = addDays(base, days);
      setAnchor(next);
      return next;
    });
  }, []);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      if (e.ctrlKey && viewMode === "week" && weekScrollRef.current) {
        const el = weekScrollRef.current;
        if (e.key === "e") {
          e.preventDefault();
          el.scrollBy({ top: 60, behavior: "smooth" });
          return;
        }
        if (e.key === "y") {
          e.preventDefault();
          el.scrollBy({ top: -60, behavior: "smooth" });
          return;
        }
        if (e.key === "d") {
          e.preventDefault();
          el.scrollBy({ top: el.clientHeight / 2, behavior: "smooth" });
          return;
        }
        if (e.key === "u") {
          e.preventDefault();
          el.scrollBy({ top: -el.clientHeight / 2, behavior: "smooth" });
          return;
        }
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const isModifier = ["Shift", "Control", "Alt", "Meta"].includes(e.key);

      if (pendingBracket.current && !isModifier) {
        const bracket = pendingBracket.current;
        pendingBracket.current = null;
        if (bracketTimer.current) {
          clearTimeout(bracketTimer.current);
          bracketTimer.current = null;
        }

        if (e.key === bracket) {
          e.preventDefault();
          if (bracket === "[") {
            if (viewMode === "week") prevWeek();
            else prevMonth();
          } else {
            if (viewMode === "week") nextWeek();
            else nextMonth();
          }
          return;
        }
        return;
      }

      if (e.key === "h") {
        e.preventDefault();
        moveSelection(-1);
        return;
      }
      if (e.key === "l") {
        e.preventDefault();
        moveSelection(1);
        return;
      }
      if (e.key === "j") {
        e.preventDefault();
        moveSelection(7);
        return;
      }
      if (e.key === "k") {
        e.preventDefault();
        moveSelection(-7);
        return;
      }
      if (e.key === "Enter" && selectedDate) {
        e.preventDefault();
        router.push(`/?date=${formatDateKey(selectedDate)}`);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSelectedDate(null);
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
    [
      moveSelection,
      selectedDate,
      router,
      viewMode,
      prevWeek,
      nextWeek,
      prevMonth,
      nextMonth,
      goToday,
    ],
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
        <WeekTimeGrid
          weekStart={weekAnchor}
          today={today}
          allDayTasksByDate={allDayTasksByDate}
          timedTasksByDate={timedTasksByDate}
          onSlotClick={handleSlotClick}
          onTaskClick={setSelectedTask}
          categoryColors={categoryColors}
          selectedDate={selectedDate}
          scrollRef={weekScrollRef}
        />
      ) : (
        <MonthGrid
          monthStart={monthStart}
          today={today}
          tasksByDate={tasksByDate}
          onDayClick={handleDayClick}
          onTaskClick={setSelectedTask}
          dayNames={DAY_NAMES}
          categoryColors={categoryColors}
          selectedDate={selectedDate}
        />
      )}

      <TaskDetail
        task={selectedTask}
        open={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}
