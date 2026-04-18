"use client";

import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import type {
  DateClickArg,
  EventResizeDoneArg,
} from "@fullcalendar/interaction";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { MapPinSimple, VideoCamera } from "@phosphor-icons/react";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import type { Task } from "@/core/types";

import "./fc-styles.css";

export type FcViewMode = "day" | "week" | "month";

export interface FcCalendarHandle {
  prev: () => void;
  next: () => void;
  today: () => void;
  changeView: (mode: FcViewMode) => void;
  gotoDate: (date: Date) => void;
  scrollToTime: (hour: number) => void;
  getScrollerEl: () => HTMLElement | null;
}

interface FcCalendarProps {
  events: EventInput[];
  viewMode: FcViewMode;
  initialDate: Date;
  allDaySlot: boolean;
  onEventClick: (task: Task, isVirtual: boolean) => void;
  onEventDrop: (
    task: Task,
    isVirtual: boolean,
    newStart: Date,
    newEnd: Date | null,
    newAllDay: boolean,
    revert: () => void,
  ) => void;
  onEventResize: (
    task: Task,
    isVirtual: boolean,
    newStart: Date,
    newEnd: Date,
    revert: () => void,
  ) => void;
  onDateSelect: (start: Date, end: Date, allDay: boolean) => void;
  onDateClick: (date: Date, allDay: boolean) => void;
  onDatesSet: (start: Date, end: Date) => void;
}

function renderEventContent(arg: EventContentArg) {
  const task = arg.event.extendedProps.task as Task | undefined;
  const isRecurring = Boolean(arg.event.extendedProps.isRecurring);
  const isDoneOrCancelled =
    task?.status === "done" || task?.status === "cancelled";
  const titleClass = isDoneOrCancelled ? "line-through" : "";

  return (
    <div className="fc-delta-event-inner">
      <div className="fc-delta-event-title">
        {isRecurring && (
          <span className="fc-delta-recur" role="img" aria-label="recurring">
            {"\u21BB"}
          </span>
        )}
        <span className={`fc-delta-title-text ${titleClass}`}>
          {arg.event.title}
        </span>
        {task?.location && (
          <MapPinSimple
            className="fc-delta-icon"
            aria-label="location"
            weight="regular"
          />
        )}
        {task?.meetingUrl && (
          <VideoCamera
            className="fc-delta-icon"
            aria-label="meeting"
            weight="regular"
          />
        )}
      </div>
      {arg.timeText && (
        <div className="fc-delta-event-time">{arg.timeText}</div>
      )}
    </div>
  );
}

function viewName(
  mode: FcViewMode,
): "timeGridDay" | "timeGridWeek" | "dayGridMonth" {
  if (mode === "day") return "timeGridDay";
  if (mode === "week") return "timeGridWeek";
  return "dayGridMonth";
}

export const FcCalendar = forwardRef<FcCalendarHandle, FcCalendarProps>(
  function FcCalendar(props, ref) {
    const {
      events,
      viewMode,
      initialDate,
      allDaySlot,
      onEventClick,
      onEventDrop,
      onEventResize,
      onDateSelect,
      onDateClick,
      onDatesSet,
    } = props;

    const fcRef = useRef<FullCalendar>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const getScrollerEl = useCallback((): HTMLElement | null => {
      const root = containerRef.current;
      if (!root) return null;
      return (
        root.querySelector<HTMLElement>(".fc-timegrid-body .fc-scroller") ??
        root.querySelector<HTMLElement>(".fc-scroller-liquid-absolute") ??
        root.querySelector<HTMLElement>(".fc-scroller")
      );
    }, []);

    useImperativeHandle(
      ref,
      (): FcCalendarHandle => ({
        prev: () => fcRef.current?.getApi().prev(),
        next: () => fcRef.current?.getApi().next(),
        today: () => fcRef.current?.getApi().today(),
        changeView: (mode) =>
          fcRef.current?.getApi().changeView(viewName(mode)),
        gotoDate: (date) => fcRef.current?.getApi().gotoDate(date),
        scrollToTime: (hour) => {
          const h = Math.max(0, Math.min(23, Math.floor(hour)));
          fcRef.current
            ?.getApi()
            .scrollToTime(`${String(h).padStart(2, "0")}:00:00`);
        },
        getScrollerEl,
      }),
      [getScrollerEl],
    );

    const handleEventClick = useCallback(
      (arg: EventClickArg) => {
        const task = arg.event.extendedProps.task as Task | undefined;
        const isVirtual = Boolean(arg.event.extendedProps.isVirtual);
        if (!task) return;
        onEventClick(task, isVirtual);
      },
      [onEventClick],
    );

    const handleEventDrop = useCallback(
      (arg: EventDropArg) => {
        const task = arg.event.extendedProps.task as Task | undefined;
        const isVirtual = Boolean(arg.event.extendedProps.isVirtual);
        if (!task || !arg.event.start) {
          arg.revert();
          return;
        }
        onEventDrop(
          task,
          isVirtual,
          arg.event.start,
          arg.event.end ?? null,
          arg.event.allDay,
          arg.revert,
        );
      },
      [onEventDrop],
    );

    const handleEventResize = useCallback(
      (arg: EventResizeDoneArg) => {
        const task = arg.event.extendedProps.task as Task | undefined;
        const isVirtual = Boolean(arg.event.extendedProps.isVirtual);
        if (!task || !arg.event.start || !arg.event.end) {
          arg.revert();
          return;
        }
        onEventResize(
          task,
          isVirtual,
          arg.event.start,
          arg.event.end,
          arg.revert,
        );
      },
      [onEventResize],
    );

    const handleSelect = useCallback(
      (arg: DateSelectArg) => {
        onDateSelect(arg.start, arg.end, arg.allDay);
      },
      [onDateSelect],
    );

    const handleDateClick = useCallback(
      (arg: DateClickArg) => {
        onDateClick(arg.date, arg.allDay);
      },
      [onDateClick],
    );

    const handleDatesSet = useCallback(
      (arg: DatesSetArg) => {
        onDatesSet(arg.start, arg.end);
      },
      [onDatesSet],
    );

    return (
      <div ref={containerRef} className="fc-delta-root flex-1 min-h-0">
        <FullCalendar
          ref={fcRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={viewName(viewMode)}
          initialDate={initialDate}
          headerToolbar={false}
          dayHeaderFormat={{ weekday: "short", day: "numeric" }}
          allDaySlot={allDaySlot}
          editable
          selectable
          selectMirror
          nowIndicator
          slotDuration="00:15:00"
          snapDuration="00:15:00"
          slotLabelInterval="01:00"
          slotLabelFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          firstDay={0}
          slotEventOverlap
          expandRows
          height="100%"
          events={events}
          eventContent={renderEventContent}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          select={handleSelect}
          dateClick={handleDateClick}
          datesSet={handleDatesSet}
          dayMaxEvents
          fixedWeekCount
          scrollTime={`${String(Math.max(0, new Date().getHours() - 1)).padStart(2, "0")}:00:00`}
        />
      </div>
    );
  },
);
