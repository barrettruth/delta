"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { updateTaskAction } from "@/app/actions/tasks";
import { AllDayBar } from "@/components/calendar/all-day-bar";
import { MonthGrid } from "@/components/calendar/month-grid";
import { WeekTimeGrid } from "@/components/calendar/week-time-grid";
import { useNavigation } from "@/contexts/navigation";
import { useTaskPanel } from "@/contexts/task-panel";
import type { Task } from "@/core/types";
import {
  addDays,
  buildDayPreFill,
  buildRangePreFill,
  buildSlotPreFill,
  DAY_NAMES,
  formatDateKey,
  formatMonthTitle,
  formatWeekRange,
  getWeekStart,
  minuteToISOString,
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
  const panel = useTaskPanel();
  const { pendingEdits } = panel;
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const pendingBracket = useRef<"[" | "]" | null>(null);
  const pendingG = useRef<number | null | false>(false);
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const bracketTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const [allDayExpanded, setAllDayExpanded] = useState(false);
  const [optimisticUpdates, setOptimisticUpdates] = useState<
    Map<number, { startAt?: string; endAt?: string }>
  >(new Map());

  const prevTasksRef = useRef(tasks);
  useEffect(() => {
    if (prevTasksRef.current !== tasks && optimisticUpdates.size > 0) {
      setOptimisticUpdates(new Map());
    }
    prevTasksRef.current = tasks;
  }, [tasks, optimisticUpdates.size]);

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
      const update = optimisticUpdates.get(task.id);
      const pending = pendingEdits.get(task.id);
      const merged =
        update || pending ? { ...task, ...pending, ...update } : task;
      const key = (merged.startAt as string).slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(merged);
    }
    if (panel.mode === "create" && panel.preFill?.startAt && !panel.preFill.allDay) {
      const preview = {
        id: -1,
        userId: 0,
        description: "new task",
        status: "pending" as const,
        category: panel.preFill.category ?? null,
        label: null,
        due: panel.preFill.due ?? null,
        startAt: panel.preFill.startAt,
        endAt: panel.preFill.endAt ?? null,
        allDay: 0,
        recurrence: null,
        recurMode: null,
        location: null,
        meetingUrl: null,
        notes: null,
        order: 0,
        timezone: null,
        completedAt: null,
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      } as Task;
      const key = panel.preFill.startAt.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(preview);
    }
    return map;
  }, [tasks, optimisticUpdates, pendingEdits, panel.mode, panel.preFill]);

  const allDayTasks = useMemo(() => {
    return tasks.filter((t) => t.allDay === 1 && t.startAt);
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
    panel.create(buildDayPreFill(date));
  }

  function handleSlotClick(
    date: Date,
    minuteOfDay: number,
    _anchor: Element | { getBoundingClientRect: () => DOMRect },
  ) {
    setSelectedDate(date);
    setAnchor(date);
    panel.create(buildSlotPreFill(date, minuteOfDay));
  }

  const weekDays = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < 7; i++) {
      result.push(addDays(weekAnchor, i));
    }
    return result;
  }, [weekAnchor]);

  const handleEventMove = useCallback(
    (
      taskId: number,
      newStartMinStr: string,
      newEndMinStr: string | null,
      dayIndex?: number,
    ) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || !task.startAt) return;
      const baseDate =
        dayIndex !== undefined ? weekDays[dayIndex] : new Date(task.startAt);
      if (!baseDate) return;
      const newStartMin = Number.parseInt(newStartMinStr, 10);
      const newStartAt = minuteToISOString(baseDate, newStartMin);
      const newEndAt =
        newEndMinStr !== null
          ? minuteToISOString(baseDate, Number.parseInt(newEndMinStr, 10))
          : null;
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        next.set(taskId, {
          startAt: newStartAt,
          ...(newEndAt !== null ? { endAt: newEndAt } : {}),
        });
        return next;
      });
      updateTaskAction(taskId, {
        startAt: newStartAt,
        endAt: newEndAt,
      });
    },
    [tasks, weekDays],
  );

  const handleEventResize = useCallback(
    (taskId: number, newEndMinStr: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || !task.startAt) return;
      const baseDate = new Date(task.startAt);
      const newEndMin = Number.parseInt(newEndMinStr, 10);
      const newEndAt = minuteToISOString(baseDate, newEndMin);
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        next.set(taskId, { endAt: newEndAt });
        return next;
      });
      updateTaskAction(taskId, { endAt: newEndAt });
    },
    [tasks],
  );

  const handleEventResizeStart = useCallback(
    (taskId: number, newStartMinStr: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || !task.startAt) return;
      const baseDate = new Date(task.startAt);
      const newStartMin = Number.parseInt(newStartMinStr, 10);
      const newStartAt = minuteToISOString(baseDate, newStartMin);
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        next.set(taskId, { startAt: newStartAt });
        return next;
      });
      updateTaskAction(taskId, { startAt: newStartAt });
    },
    [tasks],
  );

  const handleRangeCreate = useCallback(
    (
      dayIndex: number,
      startMinute: number,
      endMinute: number,
      _anchorRect: DOMRect,
    ) => {
      const date = weekDays[dayIndex];
      if (!date) return;
      panel.create(buildRangePreFill(date, startMinute, endMinute));
    },
    [weekDays, panel],
  );

  const prevWeek = useCallback(() => {
    setAnchor((d) => addDays(d ?? new Date(), -7));
  }, []);
  const nextWeek = useCallback(() => {
    setAnchor((d) => addDays(d ?? new Date(), 7));
  }, []);
  const prevMonth = useCallback(() => {
    setAnchor((d) => {
      const b = d ?? new Date();
      const targetMonth = b.getMonth() - 1;
      const targetYear = b.getFullYear();
      const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
      const day = Math.min(b.getDate(), lastDay);
      return new Date(targetYear, targetMonth, day);
    });
  }, []);
  const nextMonth = useCallback(() => {
    setAnchor((d) => {
      const b = d ?? new Date();
      const targetMonth = b.getMonth() + 1;
      const targetYear = b.getFullYear();
      const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
      const day = Math.min(b.getDate(), lastDay);
      return new Date(targetYear, targetMonth, day);
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
      if (e.key === "E" && viewMode === "week") {
        e.preventDefault();
        setAllDayExpanded((prev) => !prev);
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
      pendingBracket.current = null;
      pendingG.current = false;
      countBuf.current = "";
    };
  }, []);

  useEffect(() => {
    const handleQuickCreate = () => {
      if (!selectedDate) return;
      const preFill =
        viewMode === "week"
          ? buildSlotPreFill(selectedDate, selectedDate.getHours() * 60)
          : buildDayPreFill(selectedDate);
      panel.create(preFill);
    };
    window.addEventListener("open-calendar-quick-create", handleQuickCreate);
    return () =>
      window.removeEventListener(
        "open-calendar-quick-create",
        handleQuickCreate,
      );
  }, [selectedDate, viewMode, panel]);

  useEffect(() => {
    const pendingId = nav.consumePendingTaskDetail();
    if (pendingId != null) {
      panel.open(pendingId);
    }
  }, [nav.consumePendingTaskDetail, panel]);

  useEffect(() => {
    nav.registerScrollContainer(weekScrollRef.current);
    return () => nav.registerScrollContainer(null);
  }, [nav.registerScrollContainer]);

  const headerTitle =
    viewMode === "week"
      ? formatWeekRange(weekAnchor)
      : formatMonthTitle(monthStart);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-center px-6 py-3 border-b border-border/60 shrink-0">
        <h2 className="text-lg font-semibold tracking-tight">{headerTitle}</h2>
      </div>

      {viewMode === "week" && allDayTasks.length > 0 && (
        <AllDayBar
          weekStart={weekAnchor}
          allDayTasks={allDayTasks}
          expanded={allDayExpanded}
          categoryColors={categoryColors}
          onTaskClick={(task) => {
            nav.pushJump();
            panel.toggle(task.id);
          }}
        />
      )}

      {viewMode === "week" ? (
        <WeekTimeGrid
          weekStart={weekAnchor}
          today={today ?? new Date()}
          timedTasksByDate={timedTasksByDate}
          onSlotClick={handleSlotClick}
          onTaskClick={(task) => {
            nav.pushJump();
            panel.toggle(task.id);
          }}
          categoryColors={categoryColors}
          selectedDate={selectedDate}
          scrollRef={weekScrollRef}
          onEventMove={handleEventMove}
          onEventResize={handleEventResize}
          onEventResizeStart={handleEventResizeStart}
          onRangeCreate={handleRangeCreate}
        />
      ) : (
        <MonthGrid
          monthStart={monthStart}
          today={today ?? new Date()}
          tasksByDate={tasksByDate}
          onDayClick={handleDayClick}
          onTaskClick={(task) => {
            nav.pushJump();
            panel.toggle(task.id);
          }}
          dayNames={DAY_NAMES}
          categoryColors={categoryColors}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
}
