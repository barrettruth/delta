"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  materializeInstanceAction,
  updateTaskAction,
} from "@/app/actions/tasks";
import type { PopoverAnchor } from "@/components/calendar/event-popover";
import type { RecurrenceStrategy } from "@/components/recurrence-strategy-dialog";
import { readOnlyImportMessage } from "@/components/task-source-indicator";
import { useKeyboardHelp } from "@/contexts/keyboard-help";
import { useStatusBar } from "@/contexts/status-bar";
import { useTaskPanel } from "@/contexts/task-panel";
import type { Task } from "@/core/types";
import { useRecurrenceEdit } from "@/hooks/use-recurrence-edit";
import { useTaskOperations } from "@/hooks/use-task-operations";
import {
  buildDayPreFill,
  buildRangePreFill,
  buildSlotPreFill,
} from "@/lib/calendar-utils";
import type { FcCalendarHandle, FcViewMode } from "./fc-calendar";
import { useCalendarEvents } from "./use-calendar-events";
import { useCalendarKeyboard } from "./use-calendar-keyboard";
import {
  useCalendarNavigation,
  useCalendarScrollerRegistration,
} from "./use-calendar-navigation";

export function useCalendarViewController({
  categoryColors,
  defaultViewMode,
  tasks,
}: {
  categoryColors: Record<string, string>;
  defaultViewMode: FcViewMode;
  tasks: Task[];
}) {
  const statusBar = useStatusBar();
  const panel = useTaskPanel();
  const { openKeyboardHelp } = useKeyboardHelp();
  const { pendingEdits, optimisticTasks, setOptimisticTask } = panel;
  const recurrenceEdit = useRecurrenceEdit();
  const taskOperations = useTaskOperations({ tasks });
  const fcRef = useRef<FcCalendarHandle>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<PopoverAnchor>(null);

  const navigation = useCalendarNavigation({ defaultViewMode, fcRef });
  const {
    anchor,
    focusedDate,
    goNextPeriod,
    goPrevPeriod,
    goToday,
    handleDatesSet,
    headerTitle,
    isTimeGridView,
    moveFocusedDate,
    nav,
    rangeEnd,
    rangeStart,
    setFocusedDate,
    setFocusedViewMode,
    viewMode,
  } = navigation;

  const calendarEvents = useCalendarEvents({
    categoryColors,
    isTimeGridView,
    optimisticTasks,
    panelIsOpen: panel.isOpen,
    panelMode: panel.mode,
    panelPreFill: panel.preFill,
    pendingEdits,
    rangeEnd,
    rangeStart,
    tasks,
  });
  const {
    addMasterExdate,
    allDaySlotVisible,
    clearOptimisticUpdate,
    events,
    eventsWithPreview,
    hasVisibleAllDayEvents,
    pushOptimistic,
    setAllDayVisible,
    virtualMetaRef,
  } = calendarEvents;

  useCalendarScrollerRegistration({
    allDaySlotVisible,
    fcRef,
    registerScrollContainer: nav.registerScrollContainer,
    viewMode,
  });

  const dismissPopover = useCallback(() => {
    setPopoverAnchor(null);
    panel.close();
  }, [panel]);

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const count = events.length;
    const eventLabel =
      count > 0 ? `${count} event${count !== 1 ? "s" : ""}` : "";
    const right = [eventLabel, timezone].filter(Boolean).join("  ");
    statusBar.setIdle(`-- CALENDAR -- ${viewMode}`, right);
  }, [viewMode, events.length, statusBar.setIdle]);

  useEffect(() => {
    const pendingId = nav.consumePendingTaskDetail();
    if (pendingId != null) panel.open(pendingId);
  }, [nav.consumePendingTaskDetail, panel]);

  const openTaskFromEvent = useCallback(
    (task: Task, isVirtual: boolean, anchorEl: HTMLElement) => {
      nav.pushJump();
      setPopoverAnchor(anchorEl);
      if (isVirtual) {
        const meta = virtualMetaRef.current.get(task.id);
        if (meta) {
          const { masterId, instanceDate } = meta;
          materializeInstanceAction(masterId, instanceDate).then((result) => {
            if ("data" in result) {
              setOptimisticTask(result.data);
              addMasterExdate(masterId, new Date(instanceDate).toISOString());
              panel.toggle(result.data.id);
            }
          });
          return;
        }
      }
      panel.toggle(task.id);
    },
    [addMasterExdate, nav, panel, setOptimisticTask, virtualMetaRef],
  );

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

      if (task.sourceInfo?.readOnly) {
        statusBar.warning(readOnlyImportMessage(task.sourceInfo));
        revert();
        return;
      }

      const isDueOnly = !task.startAt && Boolean(task.due);
      if (isDueOnly && newAllDay) {
        const dueStr =
          (task.due as string).length === 10
            ? newStart.toISOString().slice(0, 10)
            : newStart.toISOString();
        pushOptimistic(task.id, {});
        updateTaskAction(task.id, { due: dueStr }).then((result) => {
          if ("error" in result) {
            clearOptimisticUpdate(task.id);
            revert();
          }
        });
        return;
      }

      const startAt = newStart.toISOString();
      const endAt = newEnd ? newEnd.toISOString() : null;

      pushOptimistic(task.id, { startAt, endAt });

      const updates: Parameters<typeof updateTaskAction>[1] = {
        startAt,
        endAt,
        allDay: newAllDay ? 1 : 0,
      };
      if (isDueOnly) updates.due = null;

      if (meta) {
        recurrenceEdit.requestEdit(meta.masterId, meta.instanceDate, updates);
      } else {
        updateTaskAction(task.id, updates).then((result) => {
          if ("error" in result) {
            clearOptimisticUpdate(task.id);
            revert();
          }
        });
      }
    },
    [
      clearOptimisticUpdate,
      pushOptimistic,
      recurrenceEdit,
      statusBar,
      virtualMetaRef,
    ],
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
    (start: Date, end: Date, allDay: boolean, anchorRect: DOMRect) => {
      setFocusedDate(start);
      setPopoverAnchor({ rect: anchorRect });
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
    [panel, setFocusedDate],
  );

  const handleDateClick = useCallback(
    (date: Date, allDay: boolean, anchorRect: DOMRect) => {
      setFocusedDate(date);
      setPopoverAnchor({ rect: anchorRect });
      if (allDay) {
        panel.create(buildDayPreFill(date));
      } else {
        const minute = date.getHours() * 60 + date.getMinutes();
        panel.create(buildSlotPreFill(date, minute));
      }
    },
    [panel, setFocusedDate],
  );

  const goPrev = useCallback(() => {
    dismissPopover();
    goPrevPeriod();
  }, [dismissPopover, goPrevPeriod]);

  const goNext = useCallback(() => {
    dismissPopover();
    goNextPeriod();
  }, [dismissPopover, goNextPeriod]);

  const goTodayWithDismiss = useCallback(() => {
    dismissPopover();
    goToday();
  }, [dismissPopover, goToday]);

  const openCreatePanel = useCallback(() => {
    const scrollerRect = fcRef.current
      ?.getScrollerEl()
      ?.getBoundingClientRect();
    const x =
      scrollerRect && scrollerRect.width > 0
        ? scrollerRect.left + scrollerRect.width / 2
        : window.innerWidth / 2;
    const y =
      scrollerRect && scrollerRect.height > 0
        ? scrollerRect.top + Math.min(96, scrollerRect.height / 2)
        : window.innerHeight / 3;

    setPopoverAnchor({ rect: new DOMRect(x, y, 1, 1) });
    panel.create();
  }, [panel]);

  const setViewModeWithJump = useCallback(
    (mode: FcViewMode) => {
      if (mode === viewMode) return;
      nav.pushJump();
      setFocusedViewMode(mode);
    },
    [nav, setFocusedViewMode, viewMode],
  );

  const handleDayHeaderClick = useCallback(
    (date: Date) => {
      if (viewMode !== "week") return;
      dismissPopover();
      nav.pushJump();
      setFocusedViewMode("day", date);
    },
    [dismissPopover, nav, setFocusedViewMode, viewMode],
  );

  const handleRecurrenceDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) recurrenceEdit.cancel();
    },
    [recurrenceEdit],
  );

  const handleRecurrenceStrategySelect = useCallback(
    (strategy: RecurrenceStrategy) => {
      recurrenceEdit.executeStrategy(strategy);
    },
    [recurrenceEdit],
  );

  useCalendarKeyboard({
    dismissPopover,
    fcRef,
    goNextPeriod,
    goPrevPeriod,
    goToday,
    hasVisibleAllDayEvents,
    moveFocusedDate,
    onCreate: openCreatePanel,
    onHelp: openKeyboardHelp,
    setAllDayVisible,
    setViewMode: setViewModeWithJump,
    viewMode,
  });

  return {
    allDaySlotVisible,
    anchor,
    events: eventsWithPreview,
    fcRef,
    focusedDate,
    goNext,
    goPrev,
    goTodayWithDismiss,
    handleDateClick,
    handleDayHeaderClick,
    handleDateSelect,
    handleDatesSet,
    handleEventDrop,
    handleEventResize,
    handleRecurrenceDialogOpenChange,
    handleRecurrenceStrategySelect,
    headerTitle,
    openTaskFromEvent,
    popoverAnchor,
    recurrenceEdit,
    taskOperations,
    viewMode,
  };
}
