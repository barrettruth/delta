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
  goToday: () => void;
  hasVisibleAllDayEvents: boolean;
  moveFocusedDate: (days: number) => void;
  setActionsOpen: Dispatch<SetStateAction<boolean>>;
  setAllDayVisible: Dispatch<SetStateAction<boolean>>;
  setViewMode: (mode: FcViewMode) => void;
  viewMode: FcViewMode;
}) {
  const countBuf = useRef("");
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

      const consumeCount = () => {
        const count = countBuf.current
          ? Number.parseInt(countBuf.current, 10)
          : 1;
        countBuf.current = "";
        return count;
      };

      const scrollTopKey = getKeymap("calendar.scroll_top").triggerKey;

      if (pendingG.current) {
        pendingG.current = false;
        if (gTimer.current) {
          clearTimeout(gTimer.current);
          gTimer.current = null;
        }
        if (event.key === scrollTopKey && isTimeGrid) {
          event.preventDefault();
          const hour = countBuf.current
            ? Math.min(23, Number.parseInt(countBuf.current, 10))
            : 0;
          countBuf.current = "";
          fcRef.current?.scrollToTime(hour);
          return;
        }
        const actionsKey = getKeymap("calendar.actions").triggerKey;
        if (event.key === actionsKey) {
          event.preventDefault();
          setActionsOpen(true);
          countBuf.current = "";
          return;
        }
        countBuf.current = "";
        return;
      }

      if (event.key >= "1" && event.key <= "9") {
        countBuf.current += event.key;
        return;
      }
      if (event.key === "0" && countBuf.current) {
        countBuf.current += "0";
        return;
      }

      if (event.key === scrollTopKey) {
        event.preventDefault();
        pendingG.current = true;
        gTimer.current = setTimeout(() => {
          pendingG.current = false;
          countBuf.current = "";
          gTimer.current = null;
        }, LEADER_TIMEOUT_MS);
        return;
      }

      const scrollBottomKey = getKeymap("calendar.scroll_bottom").triggerKey;
      if (event.key === scrollBottomKey && isTimeGrid) {
        event.preventDefault();
        const count = countBuf.current
          ? Math.min(23, Number.parseInt(countBuf.current, 10))
          : 23;
        countBuf.current = "";
        fcRef.current?.scrollToTime(count);
        return;
      }

      const prevKey = getKeymap("calendar.focus_prev_day").triggerKey;
      if (event.key === prevKey) {
        event.preventDefault();
        dismissPopover();
        const count = consumeCount();
        moveFocusedDate(-count);
        return;
      }

      const nextKey = getKeymap("calendar.focus_next_day").triggerKey;
      if (event.key === nextKey) {
        event.preventDefault();
        dismissPopover();
        const count = consumeCount();
        moveFocusedDate(count);
        return;
      }

      const prevWeekKey = getKeymap("calendar.focus_prev_week").triggerKey;
      if (event.key === prevWeekKey) {
        event.preventDefault();
        dismissPopover();
        const count = consumeCount();
        moveFocusedDate(-7 * count);
        return;
      }

      const nextWeekKey = getKeymap("calendar.focus_next_week").triggerKey;
      if (event.key === nextWeekKey) {
        event.preventDefault();
        dismissPopover();
        const count = consumeCount();
        moveFocusedDate(7 * count);
        return;
      }

      const alldayKey = getKeymap("calendar.toggle_allday").triggerKey;
      if (event.key === alldayKey && isTimeGrid) {
        event.preventDefault();
        countBuf.current = "";
        if (hasVisibleAllDayEvents) setAllDayVisible((prev) => !prev);
        return;
      }

      const dayViewKey = getKeymap("calendar.day_view").triggerKey;
      if (event.key === dayViewKey) {
        event.preventDefault();
        countBuf.current = "";
        dismissPopover();
        setViewMode("day");
        return;
      }

      const weekViewKey = getKeymap("calendar.week_view").triggerKey;
      if (event.key === weekViewKey) {
        event.preventDefault();
        countBuf.current = "";
        dismissPopover();
        setViewMode("week");
        return;
      }

      const monthViewKey = getKeymap("calendar.month_view").triggerKey;
      if (event.key === monthViewKey) {
        event.preventDefault();
        countBuf.current = "";
        dismissPopover();
        setViewMode("month");
        return;
      }

      const todayKey = getKeymap("calendar.today").triggerKey;
      if (event.key === todayKey) {
        event.preventDefault();
        countBuf.current = "";
        dismissPopover();
        goToday();
        return;
      }

      countBuf.current = "";
    },
    [
      dismissPopover,
      fcRef,
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
    );
  }, [handleKey, actionsOpen]);

  useEffect(() => {
    return () => {
      if (gTimer.current) clearTimeout(gTimer.current);
      pendingG.current = false;
      countBuf.current = "";
    };
  }, []);
}
