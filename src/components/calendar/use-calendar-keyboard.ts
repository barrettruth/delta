"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { useCallback, useEffect, useRef } from "react";
import { registerScopedKeydown } from "@/lib/keyboard";
import { getKeymap, matchesEvent } from "@/lib/keymap-defs";
import type { FcCalendarHandle, FcViewMode } from "./fc-calendar";

const LEADER_TIMEOUT_MS = 1200;

export function useCalendarKeyboard({
  actionsOpen,
  dismissPopover,
  fcRef,
  goNextPeriod,
  goPrevPeriod,
  goToday,
  hasVisibleAllDayEvents,
  moveFocusedDate,
  setActionsOpen,
  setAllDayVisible,
  setViewMode,
  viewMode,
}: {
  actionsOpen: boolean;
  dismissPopover: () => void;
  fcRef: RefObject<FcCalendarHandle | null>;
  goNextPeriod: () => void;
  goPrevPeriod: () => void;
  goToday: () => void;
  hasVisibleAllDayEvents: boolean;
  moveFocusedDate: (days: number) => void;
  setActionsOpen: Dispatch<SetStateAction<boolean>>;
  setAllDayVisible: Dispatch<SetStateAction<boolean>>;
  setViewMode: (mode: FcViewMode) => void;
  viewMode: FcViewMode;
}) {
  const pendingG = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKey = useCallback(
    (event: KeyboardEvent) => {
      const scrollerEl = fcRef.current?.getScrollerEl() ?? null;
      const isTimeGrid = viewMode === "week" || viewMode === "day";

      if (isTimeGrid && scrollerEl) {
        const HOUR = 60;
        if (matchesEvent("calendar.scroll_down_hour", event)) {
          event.preventDefault();
          scrollerEl.scrollBy({ top: HOUR });
          return;
        }
        if (matchesEvent("calendar.scroll_up_hour", event)) {
          event.preventDefault();
          scrollerEl.scrollBy({ top: -HOUR });
          return;
        }
        if (matchesEvent("calendar.half_page_down", event)) {
          event.preventDefault();
          scrollerEl.scrollBy({ top: scrollerEl.clientHeight / 2 });
          return;
        }
        if (matchesEvent("calendar.half_page_up", event)) {
          event.preventDefault();
          scrollerEl.scrollBy({ top: -scrollerEl.clientHeight / 2 });
          return;
        }
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const scrollTopKey = getKeymap("calendar.scroll_top").triggerKey;

      if (pendingG.current) {
        pendingG.current = false;
        if (gTimer.current) {
          clearTimeout(gTimer.current);
          gTimer.current = null;
        }
        if (event.key === scrollTopKey && isTimeGrid) {
          event.preventDefault();
          fcRef.current?.scrollToTime(0);
          return;
        }
        const actionsKey = getKeymap("calendar.actions").triggerKey;
        if (event.key === actionsKey) {
          event.preventDefault();
          setActionsOpen(true);
          return;
        }
        return;
      }

      if (event.key === scrollTopKey) {
        event.preventDefault();
        pendingG.current = true;
        gTimer.current = setTimeout(() => {
          pendingG.current = false;
          gTimer.current = null;
        }, LEADER_TIMEOUT_MS);
        return;
      }

      const scrollBottomKey = getKeymap("calendar.scroll_bottom").triggerKey;
      if (event.key === scrollBottomKey && isTimeGrid) {
        event.preventDefault();
        fcRef.current?.scrollToTime(23);
        return;
      }

      const prevKey = getKeymap("calendar.focus_prev_day").triggerKey;
      if (event.key === prevKey) {
        event.preventDefault();
        dismissPopover();
        moveFocusedDate(-1);
        return;
      }

      const nextKey = getKeymap("calendar.focus_next_day").triggerKey;
      if (event.key === nextKey) {
        event.preventDefault();
        dismissPopover();
        moveFocusedDate(1);
        return;
      }

      const prevWeekKey = getKeymap("calendar.focus_prev_week").triggerKey;
      if (event.key === prevWeekKey) {
        event.preventDefault();
        dismissPopover();
        moveFocusedDate(-7);
        return;
      }

      const nextWeekKey = getKeymap("calendar.focus_next_week").triggerKey;
      if (event.key === nextWeekKey) {
        event.preventDefault();
        dismissPopover();
        moveFocusedDate(7);
        return;
      }

      const prevPeriodKey = getKeymap("calendar.prev_period").triggerKey;
      if (event.key === prevPeriodKey) {
        event.preventDefault();
        dismissPopover();
        goPrevPeriod();
        return;
      }

      const nextPeriodKey = getKeymap("calendar.next_period").triggerKey;
      if (event.key === nextPeriodKey) {
        event.preventDefault();
        dismissPopover();
        goNextPeriod();
        return;
      }

      const alldayKey = getKeymap("calendar.toggle_allday").triggerKey;
      if (event.key === alldayKey && isTimeGrid) {
        event.preventDefault();
        if (hasVisibleAllDayEvents) setAllDayVisible((prev) => !prev);
        return;
      }

      const dayViewKey = getKeymap("calendar.day_view").triggerKey;
      if (event.key === dayViewKey) {
        event.preventDefault();
        dismissPopover();
        setViewMode("day");
        return;
      }

      const weekViewKey = getKeymap("calendar.week_view").triggerKey;
      if (event.key === weekViewKey) {
        event.preventDefault();
        dismissPopover();
        setViewMode("week");
        return;
      }

      const monthViewKey = getKeymap("calendar.month_view").triggerKey;
      if (event.key === monthViewKey) {
        event.preventDefault();
        dismissPopover();
        setViewMode("month");
        return;
      }

      const todayKey = getKeymap("calendar.today").triggerKey;
      if (event.key === todayKey) {
        event.preventDefault();
        dismissPopover();
        goToday();
        return;
      }
    },
    [
      dismissPopover,
      fcRef,
      goNextPeriod,
      goPrevPeriod,
      goToday,
      hasVisibleAllDayEvents,
      moveFocusedDate,
      setActionsOpen,
      setAllDayVisible,
      setViewMode,
      viewMode,
    ],
  );

  useEffect(() => {
    return registerScopedKeydown(
      window,
      { scope: "view", popoverOpen: actionsOpen },
      handleKey,
      { capture: true },
    );
  }, [handleKey, actionsOpen]);

  useEffect(() => {
    return () => {
      if (gTimer.current) clearTimeout(gTimer.current);
      pendingG.current = false;
    };
  }, []);
}
