"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigation } from "@/contexts/navigation";
import {
  addCalendarDays,
  type CalendarDateRange,
  getCalendarHeaderTitle,
  getCalendarRange,
  isCalendarTimeGridView,
  startOfCalendarDay,
} from "./calendar-view-model";
import type { FcCalendarHandle, FcViewMode } from "./fc-calendar";

export function useCalendarNavigation({
  defaultViewMode,
  fcRef,
}: {
  defaultViewMode: FcViewMode;
  fcRef: RefObject<FcCalendarHandle | null>;
}) {
  const nav = useNavigation();
  const [viewMode, setViewMode] = useState<FcViewMode>(defaultViewMode);
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [focusedDate, setFocusedDateState] = useState<Date | null>(null);
  const [visibleRange, setVisibleRange] = useState<CalendarDateRange | null>(
    null,
  );

  useEffect(() => {
    const savedAnchor = nav.getViewState<string>("cal:anchor");
    const savedFocusedDate = nav.getViewState<string>("cal:focusedDate");
    const savedMode = nav.getViewState<FcViewMode>("cal:viewMode");
    const nextAnchor = savedAnchor ? new Date(savedAnchor) : new Date();
    setAnchor(nextAnchor);
    setFocusedDateState(
      startOfCalendarDay(
        savedFocusedDate ? new Date(savedFocusedDate) : nextAnchor,
      ),
    );
    if (savedMode) setViewMode(savedMode);
  }, [nav.getViewState]);

  useEffect(() => {
    if (anchor) nav.saveViewState("cal:anchor", anchor.toISOString());
  }, [anchor, nav.saveViewState]);

  useEffect(() => {
    if (focusedDate) {
      nav.saveViewState("cal:focusedDate", focusedDate.toISOString());
    }
  }, [focusedDate, nav.saveViewState]);

  useEffect(() => {
    nav.saveViewState("cal:viewMode", viewMode);
  }, [viewMode, nav.saveViewState]);

  // Keep FC in sync when anchor or view change from keyboard. Deferring avoids
  // FullCalendar's synchronous datesSet/flushSync path during React commit.
  useEffect(() => {
    if (!anchor) return;
    queueMicrotask(() => {
      fcRef.current?.gotoDate(anchor);
    });
  }, [anchor, fcRef]);

  useEffect(() => {
    queueMicrotask(() => {
      fcRef.current?.changeView(viewMode);
    });
  }, [fcRef, viewMode]);

  const { start: rangeStart, end: rangeEnd } = useMemo(
    () => getCalendarRange({ visibleRange, anchor, viewMode }),
    [visibleRange, anchor, viewMode],
  );

  const headerTitle = useMemo(
    () => getCalendarHeaderTitle(anchor, viewMode),
    [anchor, viewMode],
  );

  const isTimeGridView = isCalendarTimeGridView(viewMode);

  const setFocusedDate = useCallback((date: Date) => {
    const next = startOfCalendarDay(date);
    setFocusedDateState(next);
    setAnchor(next);
  }, []);

  const moveFocusedDate = useCallback(
    (days: number) => {
      const base = focusedDate ?? anchor ?? new Date();
      setFocusedDate(addCalendarDays(base, days));
    },
    [anchor, focusedDate, setFocusedDate],
  );

  const setFocusedViewMode = useCallback(
    (mode: FcViewMode) => {
      const nextAnchor = focusedDate ?? anchor ?? new Date();
      setAnchor(nextAnchor);
      setViewMode(mode);
    },
    [anchor, focusedDate],
  );

  const shiftAnchorByDays = useCallback(
    (days: number) => {
      const result = addCalendarDays(anchor ?? new Date(), days);
      setAnchor(result);
      setFocusedDateState(result);
    },
    [anchor],
  );

  const prevWeek = useCallback(
    () => shiftAnchorByDays(-7),
    [shiftAnchorByDays],
  );

  const nextWeek = useCallback(() => shiftAnchorByDays(7), [shiftAnchorByDays]);

  const prevDay = useCallback(() => shiftAnchorByDays(-1), [shiftAnchorByDays]);

  const nextDay = useCallback(() => shiftAnchorByDays(1), [shiftAnchorByDays]);

  const prevMonth = useCallback(() => {
    const base = anchor ?? new Date();
    const targetMonth = base.getMonth() - 1;
    const targetYear = base.getFullYear();
    const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    const result = new Date(
      targetYear,
      targetMonth,
      Math.min(base.getDate(), lastDay),
    );
    setAnchor(result);
    setFocusedDateState(startOfCalendarDay(result));
  }, [anchor]);

  const nextMonth = useCallback(() => {
    const base = anchor ?? new Date();
    const targetMonth = base.getMonth() + 1;
    const targetYear = base.getFullYear();
    const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
    const result = new Date(
      targetYear,
      targetMonth,
      Math.min(base.getDate(), lastDay),
    );
    setAnchor(result);
    setFocusedDateState(startOfCalendarDay(result));
  }, [anchor]);

  const goToday = useCallback(
    () => setFocusedDate(new Date()),
    [setFocusedDate],
  );

  const goPrevPeriod = useCallback(() => {
    if (viewMode === "day") prevDay();
    else if (viewMode === "week") prevWeek();
    else prevMonth();
  }, [viewMode, prevDay, prevWeek, prevMonth]);

  const goNextPeriod = useCallback(() => {
    if (viewMode === "day") nextDay();
    else if (viewMode === "week") nextWeek();
    else nextMonth();
  }, [viewMode, nextDay, nextWeek, nextMonth]);

  const handleDatesSet = useCallback((start: Date, end: Date) => {
    queueMicrotask(() => setVisibleRange({ start, end }));
  }, []);

  return {
    nav,
    anchor,
    focusedDate,
    goNextPeriod,
    goPrevPeriod,
    goToday,
    handleDatesSet,
    headerTitle,
    isTimeGridView,
    moveFocusedDate,
    rangeEnd,
    rangeStart,
    setAnchor,
    setFocusedDate,
    setFocusedViewMode,
    setViewMode,
    viewMode,
  };
}

export function useCalendarScrollerRegistration({
  allDaySlotVisible,
  fcRef,
  registerScrollContainer,
  viewMode,
}: {
  allDaySlotVisible: boolean;
  fcRef: RefObject<FcCalendarHandle | null>;
  registerScrollContainer: (el: HTMLElement | null) => void;
  viewMode: FcViewMode;
}) {
  // Re-register whenever FC remounts its scroll container after view or all-day
  // slot visibility changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: view/all-day visibility changes remount FullCalendar's scroller
  useEffect(() => {
    const id = window.setTimeout(() => {
      registerScrollContainer(fcRef.current?.getScrollerEl() ?? null);
    }, 0);
    return () => {
      window.clearTimeout(id);
      registerScrollContainer(null);
    };
  }, [registerScrollContainer, fcRef, viewMode, allDaySlotVisible]);
}
