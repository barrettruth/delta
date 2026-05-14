"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarActionsPopover } from "@/components/calendar/actions-popover";
import { CalendarEventPopover } from "@/components/calendar/event-popover";
import { FcCalendar, type FcViewMode } from "@/components/calendar/fc-calendar";
import { useCalendarViewController } from "@/components/calendar/use-calendar-view-controller";
import { RecurrenceStrategyDialog } from "@/components/recurrence-strategy-dialog";
import { TaskOperationDialogs } from "@/components/task-operation-dialogs";
import type { Task } from "@/core/types";
import { onDashboardTasksChanged } from "@/lib/dashboard-refresh";

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
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [calendarData, setCalendarData] = useState(() => ({
    tasks,
    categoryColors,
    feedToken,
  }));

  useEffect(() => {
    setCalendarData({ tasks, categoryColors, feedToken });
  }, [tasks, categoryColors, feedToken]);

  useEffect(() => {
    let active = true;
    const cleanup = onDashboardTasksChanged(() => {
      const path = query
        ? `/api/dashboard/calendar?${query}`
        : "/api/dashboard/calendar";
      void fetch(path, {
        headers: { Accept: "application/json" },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!active || !data) return;
          setCalendarData({
            tasks: Array.isArray(data.tasks) ? data.tasks : tasks,
            categoryColors:
              data.categoryColors &&
              typeof data.categoryColors === "object" &&
              !Array.isArray(data.categoryColors)
                ? data.categoryColors
                : categoryColors,
            feedToken:
              typeof data.feedToken === "string" || data.feedToken === null
                ? data.feedToken
                : feedToken,
          });
        })
        .catch(() => {});
    });

    return () => {
      active = false;
      cleanup();
    };
  }, [categoryColors, feedToken, query, tasks]);

  const calendar = useCalendarViewController({
    categoryColors: calendarData.categoryColors,
    defaultViewMode,
    tasks: calendarData.tasks,
  });

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center px-2 border-b border-border/60 shrink-0"
        style={{ height: "31.5px" }}
      >
        <div className="flex-1 flex items-center">
          <button
            type="button"
            aria-label="Today"
            onClick={calendar.goTodayWithDismiss}
            className="h-6 px-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous period"
            onClick={calendar.goPrev}
            className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <CaretLeft className="size-3" weight="bold" />
          </button>
          <h2 className="text-sm font-semibold tracking-tight px-2 tabular-nums">
            {calendar.headerTitle}
          </h2>
          <button
            type="button"
            aria-label="Next period"
            onClick={calendar.goNext}
            className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <CaretRight className="size-3" weight="bold" />
          </button>
        </div>
        <div className="flex-1 flex justify-end">
          <CalendarActionsPopover
            feedToken={calendarData.feedToken}
            open={calendar.actionsOpen}
            onOpenChange={calendar.setActionsOpen}
          />
        </div>
      </div>

      {calendar.anchor && (
        <FcCalendar
          ref={calendar.fcRef}
          events={calendar.events}
          viewMode={calendar.viewMode}
          initialDate={calendar.anchor}
          allDaySlot={calendar.allDaySlotVisible}
          onEventClick={calendar.openTaskFromEvent}
          onEventDrop={calendar.handleEventDrop}
          onEventResize={calendar.handleEventResize}
          onDateSelect={calendar.handleDateSelect}
          onDateClick={calendar.handleDateClick}
          onDayHeaderClick={calendar.handleDayHeaderClick}
          onDatesSet={calendar.handleDatesSet}
        />
      )}

      <CalendarEventPopover
        tasks={calendarData.tasks}
        anchor={calendar.popoverAnchor}
      />

      <TaskOperationDialogs
        recurrenceDelete={calendar.taskOperations.recurrenceDelete}
      />

      <RecurrenceStrategyDialog
        open={!!calendar.recurrenceEdit.pending}
        onOpenChange={calendar.handleRecurrenceDialogOpenChange}
        mode="edit"
        onSelect={calendar.handleRecurrenceStrategySelect}
      />
    </div>
  );
}
