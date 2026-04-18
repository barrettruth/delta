"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteTaskAction,
  materializeInstanceAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import { CalendarActionsPopover } from "@/components/calendar/actions-popover";
import {
  FcCalendar,
  type FcCalendarHandle,
  type FcViewMode,
} from "@/components/calendar/fc-calendar";
import { RecurrenceStrategyDialog } from "@/components/recurrence-strategy-dialog";
import { useKeymaps } from "@/contexts/keymaps";
import { useNavigation } from "@/contexts/navigation";
import { useStatusBar } from "@/contexts/status-bar";
import { useTaskPanel } from "@/contexts/task-panel";
import { useUndo } from "@/contexts/undo";
import type { Task, TaskStatus } from "@/core/types";
import { useRecurrenceDelete } from "@/hooks/use-recurrence-delete";
import { useRecurrenceEdit } from "@/hooks/use-recurrence-edit";
import {
  buildDayPreFill,
  buildRangePreFill,
  buildSlotPreFill,
  formatMonthTitle,
  formatWeekRange,
  getWeekStart,
  startOfMonth,
} from "@/lib/calendar-utils";
import {
  type OptimisticUpdate,
  tasksToEvents,
  type VirtualMeta,
} from "@/lib/fullcalendar-adapter";
import { isBrowserShortcut, isInputFocused } from "@/lib/utils";

export function CalendarView({
  tasks,
  categoryColors = {},
  categories: _categories = [],
  defaultViewMode = "week",
  feedToken = null,
}: {
  tasks: Task[];
  categoryColors?: Record<string, string>;
  categories?: string[];
  defaultViewMode?: FcViewMode;
  feedToken?: string | null;
}) {
  const nav = useNavigation();
  const statusBar = useStatusBar();
  const panel = useTaskPanel();
  const undo = useUndo();
  const keymaps = useKeymaps();
  const { pendingEdits } = panel;
  const recurrenceDelete = useRecurrenceDelete();
  const recurrenceEdit = useRecurrenceEdit();

  const [viewMode, setViewMode] = useState<FcViewMode>(defaultViewMode);
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [visibleRange, setVisibleRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const [allDayVisible, setAllDayVisible] = useState(true);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [optimisticUpdates, setOptimisticUpdates] = useState<
    Map<number, OptimisticUpdate>
  >(new Map());

  const fcRef = useRef<FcCalendarHandle>(null);
  const countBuf = useRef("");
  const pendingG = useRef(false);
  const pendingOp = useRef<string | null>(null);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const virtualMetaRef = useRef(new Map<number, VirtualMeta>());

  // Clear optimistic updates when a fresh task list arrives from the server.
  const prevTasksRef = useRef(tasks);
  useEffect(() => {
    if (prevTasksRef.current !== tasks && optimisticUpdates.size > 0) {
      setOptimisticUpdates(new Map());
    }
    prevTasksRef.current = tasks;
  }, [tasks, optimisticUpdates.size]);

  useEffect(() => {
    const savedAnchor = nav.getViewState<string>("cal:anchor");
    const savedMode = nav.getViewState<FcViewMode>("cal:viewMode");
    setAnchor(savedAnchor ? new Date(savedAnchor) : new Date());
    if (savedMode) setViewMode(savedMode);
  }, [nav.getViewState]);

  useEffect(() => {
    if (anchor) nav.saveViewState("cal:anchor", anchor.toISOString());
  }, [anchor, nav]);

  useEffect(() => {
    nav.saveViewState("cal:viewMode", viewMode);
  }, [viewMode, nav]);

  // Register the FC internal scroller so other parts of the app
  // (e.g. global scroll jumps) can address it. Re-runs whenever FC remounts
  // its scroll container (view switch, all-day bar toggle).
  // biome-ignore lint/correctness/useExhaustiveDependencies: viewMode + allDayVisible gate re-registration
  useEffect(() => {
    const id = window.setTimeout(() => {
      nav.registerScrollContainer(fcRef.current?.getScrollerEl() ?? null);
    }, 0);
    return () => {
      window.clearTimeout(id);
      nav.registerScrollContainer(null);
    };
  }, [nav.registerScrollContainer, viewMode, allDayVisible]);

  // Keep FC in sync when anchor or view change from keyboard.
  useEffect(() => {
    if (anchor && fcRef.current) fcRef.current.gotoDate(anchor);
  }, [anchor]);

  useEffect(() => {
    if (fcRef.current) fcRef.current.changeView(viewMode);
  }, [viewMode]);

  const rangeStart = useMemo(() => {
    if (visibleRange) return visibleRange.start;
    if (!anchor) return getWeekStart(new Date());
    return viewMode === "week"
      ? getWeekStart(anchor)
      : getWeekStart(startOfMonth(anchor));
  }, [visibleRange, anchor, viewMode]);

  const rangeEnd = useMemo(() => {
    if (visibleRange) return visibleRange.end;
    const start = rangeStart;
    const end = new Date(start);
    end.setDate(end.getDate() + (viewMode === "week" ? 7 : 42));
    return end;
  }, [visibleRange, rangeStart, viewMode]);

  const { events, virtualMeta } = useMemo(() => {
    return tasksToEvents(tasks, {
      pendingEdits,
      optimisticUpdates,
      categoryColors,
      rangeStart,
      rangeEnd,
    });
  }, [
    tasks,
    pendingEdits,
    optimisticUpdates,
    categoryColors,
    rangeStart,
    rangeEnd,
  ]);

  virtualMetaRef.current = virtualMeta;

  const headerTitle = useMemo(() => {
    if (!anchor) return "";
    return viewMode === "week"
      ? formatWeekRange(getWeekStart(anchor))
      : formatMonthTitle(startOfMonth(anchor));
  }, [anchor, viewMode]);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const count = events.length;
    const eventLabel =
      count > 0 ? `${count} event${count !== 1 ? "s" : ""}` : "";
    const right = [eventLabel, tz].filter(Boolean).join("  ");
    statusBar.setIdle(`-- CALENDAR -- ${viewMode}`, right);
  }, [viewMode, events.length, statusBar.setIdle]);

  useEffect(() => {
    const pendingId = nav.consumePendingTaskDetail();
    if (pendingId != null) panel.open(pendingId);
  }, [nav.consumePendingTaskDetail, panel]);

  // ----- FC callbacks ---------------------------------------------------------

  const openTaskFromEvent = useCallback(
    (task: Task, isVirtual: boolean) => {
      nav.pushJump();
      if (isVirtual) {
        const meta = virtualMetaRef.current.get(task.id);
        if (meta) {
          materializeInstanceAction(meta.masterId, meta.instanceDate).then(
            (result) => {
              if ("data" in result) panel.toggle(result.data.id);
            },
          );
          return;
        }
      }
      panel.toggle(task.id);
    },
    [nav, panel],
  );

  const pushOptimistic = useCallback((id: number, update: OptimisticUpdate) => {
    setOptimisticUpdates((prev) => {
      const next = new Map(prev);
      next.set(id, { ...(next.get(id) ?? {}), ...update });
      return next;
    });
  }, []);

  const applyEventChange = useCallback(
    (
      task: Task,
      isVirtual: boolean,
      newStart: Date,
      newEnd: Date | null,
      newAllDay: boolean,
      revert: () => void,
    ) => {
      const meta = isVirtual ? virtualMetaRef.current.get(task.id) : null;
      const startAt = newStart.toISOString();
      const endAt = newEnd ? newEnd.toISOString() : null;

      pushOptimistic(task.id, { startAt, endAt });

      const updates = {
        startAt,
        endAt,
        allDay: newAllDay ? 1 : 0,
      };

      if (meta) {
        recurrenceEdit.requestEdit(meta.masterId, meta.instanceDate, updates);
      } else {
        updateTaskAction(task.id, updates).then((result) => {
          if ("error" in result) {
            setOptimisticUpdates((prev) => {
              const next = new Map(prev);
              next.delete(task.id);
              return next;
            });
            revert();
          }
        });
      }
    },
    [pushOptimistic, recurrenceEdit],
  );

  const handleEventDrop = useCallback(
    (
      task: Task,
      isVirtual: boolean,
      newStart: Date,
      newEnd: Date | null,
      newAllDay: boolean,
      revert: () => void,
    ) => {
      applyEventChange(task, isVirtual, newStart, newEnd, newAllDay, revert);
    },
    [applyEventChange],
  );

  const handleEventResize = useCallback(
    (
      task: Task,
      isVirtual: boolean,
      newStart: Date,
      newEnd: Date,
      revert: () => void,
    ) => {
      applyEventChange(
        task,
        isVirtual,
        newStart,
        newEnd,
        task.allDay === 1,
        revert,
      );
    },
    [applyEventChange],
  );

  const handleDateSelect = useCallback(
    (start: Date, end: Date, allDay: boolean) => {
      setAnchor(start);
      if (allDay) {
        panel.create(buildDayPreFill(start));
        return;
      }
      const startMin = start.getHours() * 60 + start.getMinutes();
      const endMin = end.getHours() * 60 + end.getMinutes();
      if (endMin - startMin <= 15) {
        panel.create(buildSlotPreFill(start, startMin));
      } else {
        panel.create(buildRangePreFill(start, startMin, endMin));
      }
    },
    [panel],
  );

  const handleDateClick = useCallback(
    (date: Date, allDay: boolean) => {
      setAnchor(date);
      if (allDay) {
        panel.create(buildDayPreFill(date));
      } else {
        const minute = date.getHours() * 60 + date.getMinutes();
        panel.create(buildSlotPreFill(date, minute));
      }
    },
    [panel],
  );

  const handleDatesSet = useCallback((start: Date, end: Date) => {
    setVisibleRange({ start, end });
  }, []);

  const handleDeletePanelTask = useCallback(() => {
    if (!panel.isOpen || panel.taskId == null) return;
    const target = tasks.find((t) => t.id === panel.taskId);
    if (!target) return;
    if (
      (target.recurrence || target.recurringTaskId) &&
      recurrenceDelete.requestDelete(target)
    ) {
      panel.close();
      return;
    }
    undo.push({
      id: `delete-${Date.now()}-${target.id}`,
      op: "delete",
      label: "1 task deleted",
      mutations: [
        {
          taskId: target.id,
          restore: {
            status: (target.status as TaskStatus) ?? "pending",
            completedAt: target.completedAt ?? null,
          },
        },
      ],
      timestamp: Date.now(),
    });
    deleteTaskAction(target.id);
    panel.close();
  }, [panel, tasks, recurrenceDelete, undo]);

  // ----- Navigation helpers ---------------------------------------------------

  const prevWeek = useCallback(
    () =>
      setAnchor((d) => {
        const r = new Date(d ?? new Date());
        r.setDate(r.getDate() - 7);
        return r;
      }),
    [],
  );
  const nextWeek = useCallback(
    () =>
      setAnchor((d) => {
        const r = new Date(d ?? new Date());
        r.setDate(r.getDate() + 7);
        return r;
      }),
    [],
  );
  const prevMonth = useCallback(() => {
    setAnchor((d) => {
      const b = d ?? new Date();
      const tm = b.getMonth() - 1;
      const ty = b.getFullYear();
      const lastDay = new Date(ty, tm + 1, 0).getDate();
      return new Date(ty, tm, Math.min(b.getDate(), lastDay));
    });
  }, []);
  const nextMonth = useCallback(() => {
    setAnchor((d) => {
      const b = d ?? new Date();
      const tm = b.getMonth() + 1;
      const ty = b.getFullYear();
      const lastDay = new Date(ty, tm + 1, 0).getDate();
      return new Date(ty, tm, Math.min(b.getDate(), lastDay));
    });
  }, []);
  const goToday = useCallback(() => setAnchor(new Date()), []);

  // ----- Keybindings ----------------------------------------------------------

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (isBrowserShortcut(e)) return;

      const scrollerEl = fcRef.current?.getScrollerEl() ?? null;

      if (viewMode === "week" && scrollerEl) {
        const HOUR = 60; // approx scroll unit (px per hour in FC default slots)
        if (keymaps.resolvedMatchesEvent("calendar.scroll_down_hour", e)) {
          e.preventDefault();
          scrollerEl.scrollBy({ top: HOUR });
          return;
        }
        if (keymaps.resolvedMatchesEvent("calendar.scroll_up_hour", e)) {
          e.preventDefault();
          scrollerEl.scrollBy({ top: -HOUR });
          return;
        }
        if (keymaps.resolvedMatchesEvent("calendar.half_page_down", e)) {
          e.preventDefault();
          scrollerEl.scrollBy({ top: scrollerEl.clientHeight / 2 });
          return;
        }
        if (keymaps.resolvedMatchesEvent("calendar.half_page_up", e)) {
          e.preventDefault();
          scrollerEl.scrollBy({ top: -scrollerEl.clientHeight / 2 });
          return;
        }
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const isModifier = ["Shift", "Control", "Alt", "Meta"].includes(e.key);
      if (isModifier) return;

      const delKey = keymaps.getResolvedKeymap("calendar.delete").triggerKey;

      if (pendingOp.current && !isModifier) {
        const op = pendingOp.current;
        pendingOp.current = null;
        if (opTimer.current) {
          clearTimeout(opTimer.current);
          opTimer.current = null;
        }
        if (e.key === op && op === delKey) {
          e.preventDefault();
          handleDeletePanelTask();
        }
        countBuf.current = "";
        return;
      }

      const consumeCount = () => {
        const n = countBuf.current ? Number.parseInt(countBuf.current, 10) : 1;
        countBuf.current = "";
        return n;
      };

      const scrollTopKey = keymaps.getResolvedKeymap(
        "calendar.scroll_top",
      ).triggerKey;

      if (pendingG.current) {
        pendingG.current = false;
        if (gTimer.current) {
          clearTimeout(gTimer.current);
          gTimer.current = null;
        }
        if (e.key === scrollTopKey && viewMode === "week") {
          e.preventDefault();
          const hour = countBuf.current
            ? Math.min(23, Number.parseInt(countBuf.current, 10))
            : 0;
          countBuf.current = "";
          fcRef.current?.scrollToTime(hour);
          return;
        }
        const actionsKey =
          keymaps.getResolvedKeymap("calendar.actions").triggerKey;
        if (e.key === actionsKey) {
          e.preventDefault();
          setActionsOpen(true);
          countBuf.current = "";
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

      if (e.key === scrollTopKey) {
        e.preventDefault();
        pendingG.current = true;
        gTimer.current = setTimeout(() => {
          pendingG.current = false;
          countBuf.current = "";
          gTimer.current = null;
        }, 500);
        return;
      }

      const scrollBottomKey = keymaps.getResolvedKeymap(
        "calendar.scroll_bottom",
      ).triggerKey;
      if (e.key === scrollBottomKey && viewMode === "week") {
        e.preventDefault();
        const n = countBuf.current
          ? Math.min(23, Number.parseInt(countBuf.current, 10))
          : 23;
        countBuf.current = "";
        fcRef.current?.scrollToTime(n);
        return;
      }

      const prevKey = keymaps.getResolvedKeymap(
        "calendar.prev_period",
      ).triggerKey;
      if (e.key === prevKey) {
        e.preventDefault();
        const n = consumeCount();
        for (let i = 0; i < n; i++) {
          if (viewMode === "week") prevWeek();
          else prevMonth();
        }
        return;
      }
      const nextKey = keymaps.getResolvedKeymap(
        "calendar.next_period",
      ).triggerKey;
      if (e.key === nextKey) {
        e.preventDefault();
        const n = consumeCount();
        for (let i = 0; i < n; i++) {
          if (viewMode === "week") nextWeek();
          else nextMonth();
        }
        return;
      }

      const alldayKey = keymaps.getResolvedKeymap(
        "calendar.toggle_allday",
      ).triggerKey;
      if (e.key === alldayKey && viewMode === "week") {
        e.preventDefault();
        countBuf.current = "";
        setAllDayVisible((prev) => !prev);
        return;
      }

      const weekViewKey =
        keymaps.getResolvedKeymap("calendar.week_view").triggerKey;
      if (e.key === weekViewKey) {
        e.preventDefault();
        countBuf.current = "";
        setViewMode("week");
        return;
      }
      const monthViewKey = keymaps.getResolvedKeymap(
        "calendar.month_view",
      ).triggerKey;
      if (e.key === monthViewKey) {
        e.preventDefault();
        countBuf.current = "";
        setViewMode("month");
        return;
      }
      const todayKey = keymaps.getResolvedKeymap("calendar.today").triggerKey;
      if (e.key === todayKey) {
        e.preventDefault();
        countBuf.current = "";
        goToday();
        return;
      }

      if (e.key === delKey) {
        e.preventDefault();
        pendingOp.current = delKey;
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
      keymaps,
      handleDeletePanelTask,
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

  // ----- Render ---------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center h-8 px-3 md:px-6 border-b border-border/60 shrink-0">
        <div className="flex-1" />
        <h2 className="text-sm font-semibold tracking-tight">{headerTitle}</h2>
        <div className="flex-1 flex justify-end gap-1">
          <CalendarActionsPopover
            feedToken={feedToken}
            open={actionsOpen}
            onOpenChange={setActionsOpen}
          />
        </div>
      </div>

      {anchor && (
        <FcCalendar
          ref={fcRef}
          events={events}
          viewMode={viewMode}
          initialDate={anchor}
          allDaySlot={viewMode === "week" ? allDayVisible : true}
          onEventClick={openTaskFromEvent}
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          onDateSelect={handleDateSelect}
          onDateClick={handleDateClick}
          onDatesSet={handleDatesSet}
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
