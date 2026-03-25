"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MonthGrid } from "@/components/calendar/month-grid";
import { WeekTimeGrid } from "@/components/calendar/week-time-grid";
import { TaskDetail } from "@/components/task-detail";
import { Button } from "@/components/ui/button";
import { useNavigation } from "@/contexts/navigation";
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
  defaultViewMode = "week",
}: {
  tasks: Task[];
  categoryColors?: Record<string, string>;
  categories?: string[];
  defaultViewMode?: ViewMode;
}) {
  const nav = useNavigation();
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const pendingBracket = useRef<"[" | "]" | null>(null);
  const pendingG = useRef<number | null | false>(false);
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const bracketTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    const savedAnchor = nav.getViewState<string>("cal:anchor");
    const savedSelection = nav.getViewState<string>("cal:selection");
    const now = new Date();
    setAnchor(savedAnchor ? new Date(savedAnchor) : now);
    setSelectedDate(savedSelection ? new Date(savedSelection) : now);
    setToday(now);
    const msUntilMidnight =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() -
      now.getTime();
    const timer = setTimeout(() => setToday(new Date()), msUntilMidnight + 100);
    return () => clearTimeout(timer);
  }, [nav.getViewState]);

  useEffect(() => {
    if (anchor) nav.saveViewState("cal:anchor", anchor.toISOString());
  }, [anchor, nav]);

  useEffect(() => {
    if (selectedDate)
      nav.saveViewState("cal:selection", selectedDate.toISOString());
  }, [selectedDate, nav]);

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

  const weekAnchor = useMemo(
    () => (anchor ? getWeekStart(anchor) : getWeekStart(new Date())),
    [anchor],
  );
  const monthStart = useMemo(
    () => (anchor ? startOfMonth(anchor) : startOfMonth(new Date())),
    [anchor],
  );

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
    setAnchor((d) => addDays(d ?? new Date(), -7));
  }, []);
  const nextWeek = useCallback(() => {
    setAnchor((d) => addDays(d ?? new Date(), 7));
  }, []);
  const prevMonth = useCallback(() => {
    setAnchor((d) => {
      const b = d ?? new Date();
      return new Date(b.getFullYear(), b.getMonth() - 1, b.getDate());
    });
  }, []);
  const nextMonth = useCallback(() => {
    setAnchor((d) => {
      const b = d ?? new Date();
      return new Date(b.getFullYear(), b.getMonth() + 1, b.getDate());
    });
  }, []);
  const goToday = useCallback(() => {
    const now = new Date();
    setAnchor(now);
    setSelectedDate(now);
  }, []);

  const countBuf = useRef("");

  const moveSelectionDays = useCallback((days: number) => {
    setSelectedDate((prev) => {
      const base = prev ?? new Date();
      const next = addDays(base, days);
      setAnchor(next);
      return next;
    });
  }, []);

  const moveSelectionHours = useCallback((hours: number) => {
    setSelectedDate((prev) => {
      const base = prev ?? new Date();
      const next = new Date(base.getTime() + hours * 60 * 60 * 1000);
      setAnchor(next);
      return next;
    });
  }, []);

  const setSelectedHour = useCallback((hour: number) => {
    const clamped = Math.max(0, Math.min(23, hour));
    setSelectedDate((prev) => {
      const base = prev ?? new Date();
      const next = new Date(base);
      next.setHours(clamped, 0, 0, 0);
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
          el.scrollBy({ top: 60 });
          return;
        }
        if (e.key === "y") {
          e.preventDefault();
          el.scrollBy({ top: -60 });
          return;
        }
        if (e.key === "d") {
          e.preventDefault();
          el.scrollBy({ top: el.clientHeight / 2 });
          return;
        }
        if (e.key === "u") {
          e.preventDefault();
          el.scrollBy({ top: -el.clientHeight / 2 });
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
        countBuf.current = "";
        return;
      }

      if (pendingG.current !== false && !isModifier) {
        const gCount = pendingG.current;
        pendingG.current = false;
        if (gTimer.current) {
          clearTimeout(gTimer.current);
          gTimer.current = null;
        }
        if (e.key === "g") {
          e.preventDefault();
          if (viewMode === "week") {
            setSelectedHour(gCount !== null ? gCount : 0);
          }
          return;
        }
        countBuf.current = "";
        return;
      }

      if (e.key >= "1" && e.key <= "9" && !e.shiftKey) {
        e.preventDefault();
        countBuf.current += e.key;
        return;
      }
      if (e.key === "0" && countBuf.current.length > 0) {
        e.preventDefault();
        countBuf.current += e.key;
        return;
      }

      const rawCount = countBuf.current
        ? Number.parseInt(countBuf.current, 10)
        : null;
      countBuf.current = "";
      const count = rawCount ?? 1;

      if (e.key === "h") {
        e.preventDefault();
        moveSelectionDays(-count);
        return;
      }
      if (e.key === "l") {
        e.preventDefault();
        moveSelectionDays(count);
        return;
      }
      if (e.key === "j") {
        e.preventDefault();
        if (viewMode === "week") {
          moveSelectionHours(count);
        } else {
          moveSelectionDays(7 * count);
        }
        return;
      }
      if (e.key === "k") {
        e.preventDefault();
        if (viewMode === "week") {
          moveSelectionHours(-count);
        } else {
          moveSelectionDays(-7 * count);
        }
        return;
      }
      if (e.key === "e" && selectedDate) {
        e.preventDefault();
        nav.pushJump();
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
      if (e.key === "g" && !e.shiftKey) {
        e.preventDefault();
        pendingG.current = rawCount;
        gTimer.current = setTimeout(() => {
          pendingG.current = false;
          gTimer.current = null;
        }, 500);
        return;
      }
      if (e.key === "G") {
        e.preventDefault();
        if (viewMode === "week") {
          setSelectedHour(rawCount !== null ? rawCount : 23);
        }
        return;
      }
    },
    [
      moveSelectionDays,
      moveSelectionHours,
      setSelectedHour,
      selectedDate,
      router,
      viewMode,
      prevWeek,
      nextWeek,
      prevMonth,
      nextMonth,
      goToday,
      nav,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  useEffect(() => {
    return () => {
      if (bracketTimer.current) clearTimeout(bracketTimer.current);
      if (gTimer.current) clearTimeout(gTimer.current);
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
        <div />
      </div>

      {viewMode === "week" ? (
        <WeekTimeGrid
          weekStart={weekAnchor}
          today={today ?? new Date()}
          timedTasksByDate={timedTasksByDate}
          onSlotClick={handleSlotClick}
          onTaskClick={(task) => {
            nav.pushJump();
            nav.setTaskDetailOpen(task.id);
            setSelectedTask(task);
          }}
          categoryColors={categoryColors}
          selectedDate={selectedDate}
          scrollRef={weekScrollRef}
        />
      ) : (
        <MonthGrid
          monthStart={monthStart}
          today={today ?? new Date()}
          tasksByDate={tasksByDate}
          onDayClick={handleDayClick}
          onTaskClick={(task) => {
            nav.pushJump();
            nav.setTaskDetailOpen(task.id);
            setSelectedTask(task);
          }}
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
