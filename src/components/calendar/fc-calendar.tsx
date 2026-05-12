"use client";

import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
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
import {
  type CSSProperties,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Task } from "@/core/types";
import { isSameCalendarDay } from "./calendar-view-model";
import { renderCalendarEventContent } from "./event-content";

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
  focusedDate: Date | null;
  allDaySlot: boolean;
  onEventClick: (task: Task, isVirtual: boolean, anchor: HTMLElement) => void;
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
  onDateSelect: (
    start: Date,
    end: Date,
    allDay: boolean,
    anchorRect: DOMRect,
  ) => void;
  onDateClick: (date: Date, allDay: boolean, anchor: HTMLElement) => void;
  onDatesSet: (start: Date, end: Date) => void;
}

function viewName(
  mode: FcViewMode,
): "timeGridDay" | "timeGridWeek" | "dayGridMonth" {
  if (mode === "day") return "timeGridDay";
  if (mode === "week") return "timeGridWeek";
  return "dayGridMonth";
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function outlineStylesEqual(
  a: CSSProperties | null,
  b: CSSProperties | null,
): boolean {
  return (
    a?.left === b?.left &&
    a?.top === b?.top &&
    a?.width === b?.width &&
    a?.height === b?.height
  );
}

function visibleRect(target: HTMLElement): DOMRect | null {
  const rect = target.getBoundingClientRect();
  const scroller = target.closest<HTMLElement>(".fc-scroller");
  if (!scroller) return rect;

  const scrollerRect = scroller.getBoundingClientRect();
  const left = Math.max(rect.left, scrollerRect.left);
  const top = Math.max(rect.top, scrollerRect.top);
  const right = Math.min(rect.right, scrollerRect.right);
  const bottom = Math.min(rect.bottom, scrollerRect.bottom);

  if (right <= left || bottom <= top) return null;
  return new DOMRect(left, top, right - left, bottom - top);
}

function buildFocusOutlineStyle({
  dateKey,
  root,
  viewMode,
}: {
  dateKey: string;
  root: HTMLElement;
  viewMode: FcViewMode;
}): CSSProperties | null {
  const targets =
    viewMode === "month"
      ? [
          root.querySelector<HTMLElement>(
            `.fc-daygrid-day[data-date="${dateKey}"]`,
          ),
        ]
      : [
          root.querySelector<HTMLElement>(
            `.fc-daygrid-day[data-date="${dateKey}"]`,
          ),
          root.querySelector<HTMLElement>(
            `.fc-timegrid-col[data-date="${dateKey}"]`,
          ),
        ];
  const rects = targets
    .filter((target): target is HTMLElement => target != null)
    .map((target) => visibleRect(target))
    .filter((rect): rect is DOMRect => rect != null)
    .filter((rect) => rect.width > 0 && rect.height > 0);

  if (rects.length === 0) return null;

  const rootRect = root.getBoundingClientRect();
  const left = Math.min(...rects.map((rect) => rect.left)) - rootRect.left;
  const top = Math.min(...rects.map((rect) => rect.top)) - rootRect.top;
  const right = Math.max(...rects.map((rect) => rect.right)) - rootRect.left;
  const bottom = Math.max(...rects.map((rect) => rect.bottom)) - rootRect.top;

  return {
    height: `${bottom - top}px`,
    left: `${left}px`,
    top: `${top}px`,
    width: `${right - left}px`,
  };
}

/** Build a zero-width DOMRect at the pointer location for popover anchoring. */
function getPointerRect(evt: MouseEvent | TouchEvent | null): DOMRect {
  let x = 0;
  let y = 0;
  if (evt) {
    if ("clientX" in evt) {
      x = evt.clientX;
      y = evt.clientY;
    } else if (evt.touches?.[0]) {
      x = evt.touches[0].clientX;
      y = evt.touches[0].clientY;
    }
  }
  return new DOMRect(x, y, 0, 0);
}

export const FcCalendar = forwardRef<FcCalendarHandle, FcCalendarProps>(
  function FcCalendar(props, ref) {
    const {
      events,
      viewMode,
      initialDate,
      focusedDate,
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
    const [focusOutlineStyle, setFocusOutlineStyle] =
      useState<CSSProperties | null>(null);

    // FullCalendar only reacts to `window.resize` events internally (see
    // Calendar.handleWindowResize in @fullcalendar/core). When our sidebar
    // collapses/expands it animates its own width via a CSS transition,
    // which changes the calendar's container width without firing a window
    // resize. FC's cached `scrollerClientWidths` (SimpleScrollGrid state)
    // therefore stays stale until some unrelated render kicks in, producing
    // a visible lag where the day columns haven't caught up with the new
    // container width. A ResizeObserver on the root re-runs `updateSize()`
    // (which internally flushSync's preact) every animation frame that the
    // box actually changes, coalescing the stream of transition deltas into
    // at most one layout per paint.
    useEffect(() => {
      const root = containerRef.current;
      if (!root) return;
      if (typeof ResizeObserver === "undefined") return;

      let rafId: number | null = null;
      let lastW = root.getBoundingClientRect().width;
      let lastH = root.getBoundingClientRect().height;

      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        if (width === lastW && height === lastH) return;
        lastW = width;
        lastH = height;
        if (rafId != null) return;
        rafId = window.requestAnimationFrame(() => {
          rafId = null;
          fcRef.current?.getApi().updateSize();
        });
      });
      ro.observe(root);
      return () => {
        if (rafId != null) window.cancelAnimationFrame(rafId);
        ro.disconnect();
      };
    }, []);

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
        onEventClick(task, isVirtual, arg.el);
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
        // Anchor to the selection rect on screen. jsEvent may be a touch/mouse.
        const evt = arg.jsEvent as MouseEvent | TouchEvent | null;
        const rect = getPointerRect(evt);
        onDateSelect(arg.start, arg.end, arg.allDay, rect);
      },
      [onDateSelect],
    );

    const handleDateClick = useCallback(
      (arg: DateClickArg) => {
        onDateClick(arg.date, arg.allDay, arg.dayEl);
      },
      [onDateClick],
    );

    const handleDatesSet = useCallback(
      (arg: DatesSetArg) => {
        onDatesSet(arg.start, arg.end);
      },
      [onDatesSet],
    );

    const dayCellClassNames = useCallback(
      (arg: { date: Date }) =>
        focusedDate && isSameCalendarDay(arg.date, focusedDate)
          ? ["fc-delta-focused-date"]
          : [],
      [focusedDate],
    );

    const dayHeaderClassNames = useCallback(
      (arg: { date: Date }) =>
        focusedDate && isSameCalendarDay(arg.date, focusedDate)
          ? ["fc-delta-focused-date-header"]
          : [],
      [focusedDate],
    );

    useEffect(() => {
      const root = containerRef.current;
      if (!root) return;

      const syncFocusedDate = () => {
        root
          .querySelectorAll(
            ".fc-delta-focused-date, .fc-delta-focused-date-header",
          )
          .forEach((el) => {
            el.classList.remove(
              "fc-delta-focused-date",
              "fc-delta-focused-date-header",
            );
          });

        if (!focusedDate) {
          setFocusOutlineStyle((prev) =>
            outlineStylesEqual(prev, null) ? prev : null,
          );
          return;
        }

        const dateKey = formatDateKey(focusedDate);
        root
          .querySelectorAll(
            `.fc-daygrid-day[data-date="${dateKey}"], .fc-timegrid-col[data-date="${dateKey}"]`,
          )
          .forEach((el) => {
            el.classList.add("fc-delta-focused-date");
          });
        root
          .querySelectorAll(`.fc-col-header-cell[data-date="${dateKey}"]`)
          .forEach((el) => {
            el.classList.add("fc-delta-focused-date-header");
          });
        const nextStyle = buildFocusOutlineStyle({
          dateKey,
          root,
          viewMode,
        });
        setFocusOutlineStyle((prev) =>
          outlineStylesEqual(prev, nextStyle) ? prev : nextStyle,
        );
      };

      syncFocusedDate();
      const observer = new MutationObserver(syncFocusedDate);
      observer.observe(root, { childList: true, subtree: true });
      const ro =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(syncFocusedDate);
      ro?.observe(root);
      const scrollers = Array.from(root.querySelectorAll(".fc-scroller"));
      for (const scroller of scrollers) {
        scroller.addEventListener("scroll", syncFocusedDate, { passive: true });
      }
      window.addEventListener("resize", syncFocusedDate);
      const rafId = window.requestAnimationFrame(syncFocusedDate);
      return () => {
        observer.disconnect();
        ro?.disconnect();
        for (const scroller of scrollers) {
          scroller.removeEventListener("scroll", syncFocusedDate);
        }
        window.removeEventListener("resize", syncFocusedDate);
        window.cancelAnimationFrame(rafId);
      };
    }, [focusedDate, viewMode]);

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
          allDayText=""
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
          slotEventOverlap={false}
          expandRows
          height="100%"
          events={events}
          eventDisplay="block"
          eventContent={renderCalendarEventContent}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          select={handleSelect}
          dateClick={handleDateClick}
          datesSet={handleDatesSet}
          dayCellClassNames={dayCellClassNames}
          dayHeaderClassNames={dayHeaderClassNames}
          dayMaxEvents
          fixedWeekCount
          scrollTime={`${String(Math.max(0, new Date().getHours() - 1)).padStart(2, "0")}:00:00`}
        />
        {focusOutlineStyle && (
          <div
            aria-hidden="true"
            className="fc-delta-focus-outline"
            style={focusOutlineStyle}
          />
        )}
      </div>
    );
  },
);
