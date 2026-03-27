import { useCallback, useRef, useState } from "react";
import { HOUR_HEIGHT, snapMinuteTo15 } from "@/lib/calendar-utils";

type InteractionMode = "idle" | "creating" | "moving" | "resizing";

interface UseTimeGridInteractionOptions {
  hourHeight?: number;
  onSlotClick: (dayIndex: number, minuteOfDay: number) => void;
  onEventClick: (taskId: number) => void;
  onEventMove: (
    taskId: number,
    newStartAt: string,
    newEndAt: string | null,
  ) => void;
  onEventResize: (taskId: number, newEndAt: string) => void;
  onRangeCreate: (
    dayIndex: number,
    startMinute: number,
    endMinute: number,
    anchor: DOMRect,
  ) => void;
}

interface PreviewStyle {
  top: number;
  height: number;
  dayIndex: number;
}

export function useTimeGridInteraction(
  options: UseTimeGridInteractionOptions,
) {
  const {
    hourHeight = HOUR_HEIGHT,
    onSlotClick,
    onEventClick,
    onEventMove,
    onEventResize,
    onRangeCreate,
  } = options;

  const [mode, setMode] = useState<InteractionMode>("idle");
  const [previewStyle, setPreviewStyle] = useState<PreviewStyle | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);

  const modeRef = useRef<InteractionMode>("idle");
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const startMinuteRef = useRef(0);
  const currentMinuteRef = useRef(0);
  const dayIndexRef = useRef(0);
  const taskIdRef = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const eventStartMinRef = useRef(0);
  const eventEndMinRef = useRef<number | null>(null);
  const eventDurationRef = useRef(0);
  const didDragRef = useRef(false);
  const rafRef = useRef(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const pxPerMin = hourHeight / 60;

  const getMinuteFromY = useCallback(
    (clientY: number, columnEl: HTMLElement): number => {
      const rect = columnEl.getBoundingClientRect();
      const scrollParent = scrollContainerRef.current;
      const scrollTop = scrollParent ? scrollParent.scrollTop : 0;
      const y = clientY - rect.top + scrollTop;
      const minute = y / pxPerMin;
      return snapMinuteTo15(minute);
    },
    [pxPerMin],
  );

  const findColumnEl = useCallback(
    (target: HTMLElement): HTMLElement | null => {
      return target.closest("[data-day-column]") as HTMLElement | null;
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;
      const columnEl = findColumnEl(target);
      if (!columnEl) return;

      const dayIndex = Number(columnEl.dataset.dayColumn);
      dayIndexRef.current = dayIndex;
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      didDragRef.current = false;

      const scrollParent = columnEl.closest("[data-time-grid-scroll]") as HTMLElement | null;
      scrollContainerRef.current = scrollParent;

      const resizeHandle = target.closest("[data-resize-handle]");
      if (resizeHandle) {
        const eventEl = target.closest("[data-event-id]") as HTMLElement | null;
        if (!eventEl) return;
        const taskId = Number(eventEl.dataset.eventId);
        const startAt = eventEl.dataset.eventStart;
        const endAt = eventEl.dataset.eventEnd;
        if (!startAt) return;

        taskIdRef.current = taskId;
        eventStartMinRef.current = Number.parseInt(eventEl.dataset.eventStartMin || "0", 10);
        eventEndMinRef.current = endAt
          ? Number.parseInt(eventEl.dataset.eventEndMin || "0", 10)
          : eventStartMinRef.current + 15;
        currentMinuteRef.current = eventEndMinRef.current;
        modeRef.current = "resizing";

        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }

      const eventEl = target.closest("[data-event-id]") as HTMLElement | null;
      if (eventEl) {
        const taskId = Number(eventEl.dataset.eventId);
        taskIdRef.current = taskId;
        eventStartMinRef.current = Number.parseInt(eventEl.dataset.eventStartMin || "0", 10);
        eventEndMinRef.current = eventEl.dataset.eventEndMin
          ? Number.parseInt(eventEl.dataset.eventEndMin, 10)
          : null;
        eventDurationRef.current = (eventEndMinRef.current ?? eventStartMinRef.current + 15) - eventStartMinRef.current;

        const eventRect = eventEl.getBoundingClientRect();
        const scrollTop = scrollContainerRef.current ? scrollContainerRef.current.scrollTop : 0;
        const eventTopPx = eventRect.top - columnEl.getBoundingClientRect().top + scrollTop;
        const pointerPx = e.clientY - columnEl.getBoundingClientRect().top + scrollTop;
        offsetRef.current = pointerPx - eventTopPx;

        modeRef.current = "moving";
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }

      const minute = getMinuteFromY(e.clientY, columnEl);
      startMinuteRef.current = minute;
      currentMinuteRef.current = minute;
      modeRef.current = "creating";

      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [findColumnEl, getMinuteFromY],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (modeRef.current === "idle") return;

      const dx = e.clientX - startXRef.current;
      const dy = e.clientY - startYRef.current;
      if (!didDragRef.current && Math.sqrt(dx * dx + dy * dy) < 5) return;

      didDragRef.current = true;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const target = e.target as HTMLElement;
        const columnEl = findColumnEl(target) || target.closest("[data-day-column]") as HTMLElement;
        if (!columnEl) return;

        if (modeRef.current === "creating") {
          if (mode !== "creating") setMode("creating");
          const minute = getMinuteFromY(e.clientY, columnEl);
          currentMinuteRef.current = minute;
          const minStart = Math.min(startMinuteRef.current, minute);
          const maxEnd = Math.max(startMinuteRef.current, minute);
          setPreviewStyle({
            top: minStart * pxPerMin,
            height: Math.max((maxEnd - minStart) * pxPerMin, 15 * pxPerMin),
            dayIndex: dayIndexRef.current,
          });
        }

        if (modeRef.current === "moving") {
          if (mode !== "moving") {
            setMode("moving");
            setDraggingTaskId(taskIdRef.current);
          }
          const pointerMinute = getMinuteFromY(e.clientY, columnEl);
          const offsetMinutes = offsetRef.current / pxPerMin;
          const newStart = snapMinuteTo15(pointerMinute - offsetMinutes);
          currentMinuteRef.current = newStart;
          setPreviewStyle({
            top: newStart * pxPerMin,
            height: eventDurationRef.current * pxPerMin,
            dayIndex: dayIndexRef.current,
          });
        }

        if (modeRef.current === "resizing") {
          if (mode !== "resizing") {
            setMode("resizing");
            setDraggingTaskId(taskIdRef.current);
          }
          const minute = getMinuteFromY(e.clientY, columnEl);
          const newEnd = Math.max(eventStartMinRef.current + 15, minute);
          currentMinuteRef.current = snapMinuteTo15(newEnd);
          setPreviewStyle({
            top: eventStartMinRef.current * pxPerMin,
            height: (currentMinuteRef.current - eventStartMinRef.current) * pxPerMin,
            dayIndex: dayIndexRef.current,
          });
        }
      });
    },
    [findColumnEl, getMinuteFromY, mode, pxPerMin],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}

      const currentMode = modeRef.current;
      const wasDrag = didDragRef.current;

      modeRef.current = "idle";
      didDragRef.current = false;
      setMode("idle");
      setPreviewStyle(null);
      setDraggingTaskId(null);

      if (currentMode === "creating") {
        if (!wasDrag) {
          onSlotClick(dayIndexRef.current, startMinuteRef.current);
        } else {
          const minStart = Math.min(startMinuteRef.current, currentMinuteRef.current);
          const maxEnd = Math.max(startMinuteRef.current, currentMinuteRef.current);
          if (maxEnd - minStart >= 15) {
            const rect = (e.target as HTMLElement).closest("[data-day-column]")?.getBoundingClientRect();
            if (rect) {
              const anchorRect = new DOMRect(
                rect.left + rect.width / 2,
                minStart * pxPerMin + rect.top,
                0,
                (maxEnd - minStart) * pxPerMin,
              );
              onRangeCreate(dayIndexRef.current, minStart, maxEnd, anchorRect);
            }
          }
        }
      }

      if (currentMode === "moving" && taskIdRef.current !== null) {
        if (wasDrag) {
          const newStart = currentMinuteRef.current;
          const newEnd = newStart + eventDurationRef.current;
          onEventMove(
            taskIdRef.current,
            String(newStart),
            eventEndMinRef.current !== null ? String(newEnd) : null,
          );
        } else {
          onEventClick(taskIdRef.current);
        }
      }

      if (currentMode === "resizing" && taskIdRef.current !== null) {
        if (wasDrag) {
          onEventResize(taskIdRef.current, String(currentMinuteRef.current));
        } else {
          onEventClick(taskIdRef.current);
        }
      }

      taskIdRef.current = null;
    },
    [onSlotClick, onEventClick, onRangeCreate, onEventMove, onEventResize, pxPerMin],
  );

  const gridProps = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
  };

  const eventProps = useCallback(
    (_taskId: number) => ({
      onPointerDown: (e: React.PointerEvent) => {
        handlePointerDown(e);
      },
    }),
    [handlePointerDown],
  );

  return {
    gridProps,
    eventProps,
    previewStyle,
    draggingTaskId,
    mode,
  };
}
