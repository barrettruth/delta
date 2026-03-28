"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteTaskAction,
  materializeInstanceAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { AllDayBar } from "@/components/calendar/all-day-bar";
import { MonthGrid } from "@/components/calendar/month-grid";
import { WeekTimeGrid } from "@/components/calendar/week-time-grid";
import { RecurrenceStrategyDialog } from "@/components/recurrence-strategy-dialog";
import { useNavigation } from "@/contexts/navigation";
import { useTaskPanel } from "@/contexts/task-panel";
import { expandInstances } from "@/core/recurrence-expansion";
import type { Task } from "@/core/types";
import { useRecurrenceDelete } from "@/hooks/use-recurrence-delete";
import { useRecurrenceEdit } from "@/hooks/use-recurrence-edit";
import type { TimedEntry } from "@/lib/calendar-utils";
import {
  addDays,
  buildDayPreFill,
  buildRangePreFill,
  buildSlotPreFill,
  DAY_NAMES,
  formatDateKey,
  formatMonthTitle,
  formatWeekRange,
  getDatesBetween,
  getMinutesFromMidnight,
  getWeekStart,
  HOUR_HEIGHT,
  isMultiDay,
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
  const recurrenceDelete = useRecurrenceDelete();
  const recurrenceEdit = useRecurrenceEdit();
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [anchor, setAnchor] = useState<Date | null>(null);
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const countBuf = useRef("");
  const pendingG = useRef(false);
  const pendingOp = useRef<string | null>(null);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const [allDayExpanded, setAllDayExpanded] = useState(false);
  const [optimisticUpdates, setOptimisticUpdates] = useState<
    Map<number, { startAt?: string; endAt?: string }>
  >(new Map());

  const virtualMetaRef = useRef(
    new Map<number, { masterId: number; instanceDate: string }>(),
  );

  const prevTasksRef = useRef(tasks);
  useEffect(() => {
    if (prevTasksRef.current !== tasks && optimisticUpdates.size > 0) {
      setOptimisticUpdates(new Map());
    }
    prevTasksRef.current = tasks;
  }, [tasks, optimisticUpdates.size]);

  useEffect(() => {
    const savedAnchor = nav.getViewState<string>("cal:anchor");
    const savedMode = nav.getViewState<ViewMode>("cal:viewMode");
    const now = new Date();
    setAnchor(savedAnchor ? new Date(savedAnchor) : now);
    if (savedMode) setViewMode(savedMode);
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
    nav.saveViewState("cal:viewMode", viewMode);
  }, [viewMode, nav]);

  const weekAnchor = useMemo(
    () => (anchor ? getWeekStart(anchor) : getWeekStart(new Date())),
    [anchor],
  );
  const monthStart = useMemo(
    () => (anchor ? startOfMonth(anchor) : startOfMonth(new Date())),
    [anchor],
  );

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    const masters: Task[] = [];
    const exceptionsMap = new Map<number, Task[]>();

    const monthGridStart = getWeekStart(monthStart);
    const monthGridEnd = addDays(monthGridStart, 42);

    for (const task of tasks) {
      if (task.recurringTaskId) {
        const list = exceptionsMap.get(task.recurringTaskId) ?? [];
        list.push(task);
        exceptionsMap.set(task.recurringTaskId, list);
      }

      if (
        task.recurrence &&
        !task.recurringTaskId &&
        task.recurMode === "scheduled" &&
        (task.startAt || task.due) &&
        task.status !== "cancelled"
      ) {
        masters.push(task);
        continue;
      }

      if (task.recurringTaskId) continue;
      const dateSource = task.startAt || task.due;
      if (!dateSource) continue;
      const key = dateSource.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(task);
    }

    for (const master of masters) {
      const exceptions = exceptionsMap.get(master.id) ?? [];
      const instances = expandInstances(
        master,
        monthGridStart,
        monthGridEnd,
        exceptions,
      );

      for (const inst of instances) {
        if (inst.exception) {
          if (inst.exception.status === "cancelled") continue;
          const key = (
            inst.exception.startAt ??
            inst.exception.due ??
            inst.startAt
          ).slice(0, 10);
          if (!map.has(key)) map.set(key, []);
          map.get(key)?.push(inst.exception);
        } else {
          const virtual = {
            ...master,
            id: -(
              master.id * 10000000 +
              (Math.floor(inst.instanceDate.getTime() / 60000) % 10000000)
            ),
            startAt: inst.startAt,
            endAt: inst.endAt,
          } as Task;
          const key = inst.startAt.slice(0, 10);
          if (!map.has(key)) map.set(key, []);
          map.get(key)?.push(virtual);
        }
      }
    }

    return map;
  }, [tasks, monthStart]);

  const weekEnd = useMemo(() => addDays(weekAnchor, 7), [weekAnchor]);

  const timedTasksByDate = useMemo(() => {
    const map = new Map<string, TimedEntry[]>();
    const masters: Task[] = [];
    const exceptionsMap = new Map<number, Task[]>();
    const virtualMeta = new Map<
      number,
      { masterId: number; instanceDate: string }
    >();

    const addEntry = (task: Task) => {
      if (!task.startAt) return;
      const startDate = new Date(task.startAt);
      const endDate = task.endAt ? new Date(task.endAt) : null;

      if (endDate && isMultiDay(task.startAt, task.endAt!)) {
        const dates = getDatesBetween(startDate, endDate);
        for (let i = 0; i < dates.length; i++) {
          const key = formatDateKey(dates[i]);
          let continuation: "start" | "middle" | "end" | undefined;
          let timeStartMin: number;
          let timeEndMin: number;

          if (dates.length === 1) {
            timeStartMin = getMinutesFromMidnight(startDate);
            timeEndMin = getMinutesFromMidnight(endDate);
          } else if (i === 0) {
            continuation = "start";
            timeStartMin = getMinutesFromMidnight(startDate);
            timeEndMin = 1440;
          } else if (i === dates.length - 1) {
            continuation = "end";
            timeStartMin = 0;
            timeEndMin = getMinutesFromMidnight(endDate);
          } else {
            continuation = "middle";
            timeStartMin = 0;
            timeEndMin = 1440;
          }

          if (!map.has(key)) map.set(key, []);
          map.get(key)?.push({ task, continuation, timeStartMin, timeEndMin });
        }
      } else {
        const key = task.startAt.slice(0, 10);
        const timeStartMin = getMinutesFromMidnight(startDate);
        const timeEndMin = endDate
          ? getMinutesFromMidnight(endDate)
          : timeStartMin + 15;
        if (!map.has(key)) map.set(key, []);
        map.get(key)?.push({ task, timeStartMin, timeEndMin });
      }
    };

    for (const task of tasks) {
      if (task.recurringTaskId) {
        const list = exceptionsMap.get(task.recurringTaskId) ?? [];
        list.push(task);
        exceptionsMap.set(task.recurringTaskId, list);
      }

      if (
        task.recurrence &&
        !task.recurringTaskId &&
        task.recurMode === "scheduled" &&
        task.startAt &&
        task.allDay !== 1 &&
        task.status !== "cancelled"
      ) {
        masters.push(task);
        continue;
      }

      if (task.recurringTaskId) continue;
      if (!task.startAt || task.allDay === 1) continue;

      const update = optimisticUpdates.get(task.id);
      const pending = pendingEdits.get(task.id);
      const merged =
        update || pending ? { ...task, ...pending, ...update } : task;
      addEntry(merged);
    }

    for (const master of masters) {
      const exceptions = exceptionsMap.get(master.id) ?? [];
      const instances = expandInstances(
        master,
        weekAnchor,
        weekEnd,
        exceptions,
      );

      for (const inst of instances) {
        if (inst.exception) {
          if (inst.exception.status === "cancelled") continue;
          const update = optimisticUpdates.get(inst.exception.id);
          const pending = pendingEdits.get(inst.exception.id);
          const merged =
            update || pending
              ? { ...inst.exception, ...pending, ...update }
              : inst.exception;
          addEntry(merged);
        } else {
          const syntheticId = -(
            master.id * 10000000 +
            (Math.floor(inst.instanceDate.getTime() / 60000) % 10000000)
          );
          virtualMeta.set(syntheticId, {
            masterId: master.id,
            instanceDate: inst.instanceDate.toISOString(),
          });
          const virtual = {
            ...master,
            id: syntheticId,
            startAt: inst.startAt,
            endAt: inst.endAt,
          } as Task;
          const update = optimisticUpdates.get(syntheticId);
          const merged = update ? { ...virtual, ...update } : virtual;
          addEntry(merged);
        }
      }
    }

    virtualMetaRef.current = virtualMeta;

    return map;
  }, [tasks, optimisticUpdates, pendingEdits, weekAnchor, weekEnd]);

  const allDayTasks = useMemo(() => {
    return tasks.filter((t) => t.allDay === 1 && t.startAt);
  }, [tasks]);

  const createPreview = useMemo(() => {
    if (
      panel.mode !== "create" ||
      !panel.preFill?.startAt ||
      panel.preFill.allDay
    )
      return null;
    const start = new Date(panel.preFill.startAt);
    const dayOffset = Math.floor(
      (start.getTime() - weekAnchor.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (dayOffset < 0 || dayOffset > 6) return null;
    const startMin = start.getHours() * 60 + start.getMinutes();
    let endMin = startMin + 60;
    if (panel.preFill.endAt) {
      const end = new Date(panel.preFill.endAt);
      endMin = end.getHours() * 60 + end.getMinutes();
    }
    return { dayIndex: dayOffset, startMin, endMin };
  }, [panel.mode, panel.preFill, weekAnchor]);

  function handleDayClick(date: Date, _anchorEl?: HTMLElement) {
    setAnchor(date);
    panel.create(buildDayPreFill(date));
  }

  function handleSlotClick(
    date: Date,
    minuteOfDay: number,
    _anchor: Element | { getBoundingClientRect: () => DOMRect },
  ) {
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
      const meta = virtualMetaRef.current.get(taskId);
      const task = meta
        ? tasks.find((t) => t.id === meta.masterId)
        : tasks.find((t) => t.id === taskId);
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
      if (meta) {
        recurrenceEdit.requestEdit(meta.masterId, meta.instanceDate, {
          startAt: newStartAt,
          endAt: newEndAt,
        });
      } else {
        updateTaskAction(taskId, {
          startAt: newStartAt,
          endAt: newEndAt,
        });
      }
    },
    [tasks, weekDays, recurrenceEdit],
  );

  const handleEventResize = useCallback(
    (taskId: number, newEndMinStr: string) => {
      const meta = virtualMetaRef.current.get(taskId);
      const task = meta
        ? tasks.find((t) => t.id === meta.masterId)
        : tasks.find((t) => t.id === taskId);
      if (!task || !task.startAt) return;
      const baseDate = meta
        ? new Date(meta.instanceDate)
        : new Date(task.startAt);
      const newEndMin = Number.parseInt(newEndMinStr, 10);
      const newEndAt = minuteToISOString(baseDate, newEndMin);
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        next.set(taskId, { endAt: newEndAt });
        return next;
      });
      if (meta) {
        recurrenceEdit.requestEdit(meta.masterId, meta.instanceDate, {
          endAt: newEndAt,
        });
      } else {
        updateTaskAction(taskId, { endAt: newEndAt });
      }
    },
    [tasks, recurrenceEdit],
  );

  const handleEventResizeStart = useCallback(
    (taskId: number, newStartMinStr: string) => {
      const meta = virtualMetaRef.current.get(taskId);
      const task = meta
        ? tasks.find((t) => t.id === meta.masterId)
        : tasks.find((t) => t.id === taskId);
      if (!task || !task.startAt) return;
      const baseDate = meta
        ? new Date(meta.instanceDate)
        : new Date(task.startAt);
      const newStartMin = Number.parseInt(newStartMinStr, 10);
      const newStartAt = minuteToISOString(baseDate, newStartMin);
      setOptimisticUpdates((prev) => {
        const next = new Map(prev);
        next.set(taskId, { startAt: newStartAt });
        return next;
      });
      if (meta) {
        recurrenceEdit.requestEdit(meta.masterId, meta.instanceDate, {
          startAt: newStartAt,
        });
      } else {
        updateTaskAction(taskId, { startAt: newStartAt });
      }
    },
    [tasks, recurrenceEdit],
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
    setAnchor(new Date());
  }, []);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      if (e.ctrlKey && viewMode === "week" && weekScrollRef.current) {
        const el = weekScrollRef.current;
        if (e.key === "e") {
          e.preventDefault();
          el.scrollBy({ top: HOUR_HEIGHT });
          return;
        }
        if (e.key === "y") {
          e.preventDefault();
          el.scrollBy({ top: -HOUR_HEIGHT });
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
      if (isModifier) return;

      if (pendingOp.current && !isModifier) {
        const op = pendingOp.current;
        pendingOp.current = null;
        if (opTimer.current) {
          clearTimeout(opTimer.current);
          opTimer.current = null;
        }
        if (e.key === op && op === "d") {
          e.preventDefault();
          if (panel.isOpen && panel.taskId !== null) {
            const target = tasks.find((t) => t.id === panel.taskId);
            if (
              target &&
              (target.recurrence || target.recurringTaskId) &&
              recurrenceDelete.requestDelete(target)
            ) {
              panel.close();
            } else {
              deleteTaskAction(panel.taskId);
              panel.close();
            }
          }
        }
        countBuf.current = "";
        return;
      }

      const consumeCount = () => {
        const n = countBuf.current ? Number.parseInt(countBuf.current, 10) : 1;
        countBuf.current = "";
        return n;
      };

      if (pendingG.current) {
        pendingG.current = false;
        if (gTimer.current) {
          clearTimeout(gTimer.current);
          gTimer.current = null;
        }
        if (e.key === "g" && viewMode === "week" && weekScrollRef.current) {
          e.preventDefault();
          const hour = countBuf.current
            ? Math.min(23, Number.parseInt(countBuf.current, 10))
            : 0;
          countBuf.current = "";
          weekScrollRef.current.scrollTop = hour * HOUR_HEIGHT;
          return;
        }
        countBuf.current = "";
        return;
      }

      if (e.key >= "1" && e.key <= "9") {
        countBuf.current += e.key;
        return;
      }
      if (e.key === "0" && countBuf.current) {
        countBuf.current += "0";
        return;
      }

      if (e.key === "g") {
        e.preventDefault();
        pendingG.current = true;
        gTimer.current = setTimeout(() => {
          pendingG.current = false;
          countBuf.current = "";
          gTimer.current = null;
        }, 500);
        return;
      }

      if (e.key === "G" && viewMode === "week" && weekScrollRef.current) {
        e.preventDefault();
        const n = countBuf.current
          ? Math.min(23, Number.parseInt(countBuf.current, 10))
          : 23;
        countBuf.current = "";
        weekScrollRef.current.scrollTop = n * HOUR_HEIGHT;
        return;
      }

      if (e.key === "h") {
        e.preventDefault();
        const n = consumeCount();
        for (let i = 0; i < n; i++) {
          if (viewMode === "week") prevWeek();
          else prevMonth();
        }
        return;
      }
      if (e.key === "l") {
        e.preventDefault();
        const n = consumeCount();
        for (let i = 0; i < n; i++) {
          if (viewMode === "week") nextWeek();
          else nextMonth();
        }
        return;
      }

      if (e.key === "E" && viewMode === "week") {
        e.preventDefault();
        countBuf.current = "";
        setAllDayExpanded((prev) => !prev);
        return;
      }

      if (e.key === "w") {
        e.preventDefault();
        countBuf.current = "";
        setViewMode("week");
        return;
      }
      if (e.key === "m") {
        e.preventDefault();
        countBuf.current = "";
        setViewMode("month");
        return;
      }
      if (e.key === "t") {
        e.preventDefault();
        countBuf.current = "";
        goToday();
        return;
      }

      if (e.key === "d") {
        e.preventDefault();
        pendingOp.current = "d";
        opTimer.current = setTimeout(() => {
          pendingOp.current = null;
          opTimer.current = null;
        }, 500);
        return;
      }

      countBuf.current = "";
    },
    [
      viewMode,
      prevWeek,
      nextWeek,
      prevMonth,
      nextMonth,
      goToday,
      panel,
      tasks,
      recurrenceDelete,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  useEffect(() => {
    return () => {
      if (gTimer.current) clearTimeout(gTimer.current);
      if (opTimer.current) clearTimeout(opTimer.current);
      pendingG.current = false;
      pendingOp.current = null;
      countBuf.current = "";
    };
  }, []);

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
            const meta = virtualMetaRef.current.get(task.id);
            if (meta) {
              materializeInstanceAction(meta.masterId, meta.instanceDate).then(
                (result) => {
                  if ("data" in result) panel.toggle(result.data.id);
                },
              );
              return;
            }
            panel.toggle(task.id);
          }}
          categoryColors={categoryColors}
          scrollRef={weekScrollRef}
          onEventMove={handleEventMove}
          onEventResize={handleEventResize}
          onEventResizeStart={handleEventResizeStart}
          onRangeCreate={handleRangeCreate}
          createPreview={createPreview}
        />
      ) : (
        <MonthGrid
          monthStart={monthStart}
          today={today ?? new Date()}
          tasksByDate={tasksByDate}
          onDayClick={handleDayClick}
          onTaskClick={(task) => {
            nav.pushJump();
            const meta = virtualMetaRef.current.get(task.id);
            if (meta) {
              materializeInstanceAction(meta.masterId, meta.instanceDate).then(
                (result) => {
                  if ("data" in result) panel.toggle(result.data.id);
                },
              );
              return;
            }
            panel.toggle(task.id);
          }}
          dayNames={DAY_NAMES}
          categoryColors={categoryColors}
        />
      )}

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

      <RecurrenceStrategyDialog
        open={!!recurrenceEdit.pending}
        onOpenChange={(open) => {
          if (!open) recurrenceEdit.cancel();
        }}
        mode="edit"
        onSelect={(strategy) => {
          recurrenceEdit.executeStrategy(strategy);
        }}
      />
    </div>
  );
}
