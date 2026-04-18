"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Horizontal scroll-snap pager.
 *
 * Layout:  [phantom-prev] [children / real content] [phantom-next]
 *
 * The container is horizontally scrollable with `scroll-snap-type: x mandatory`.
 * On mount we center it on the middle pane. When the user swipes/scrolls and
 * settles on a neighbor, we call `onPrev` / `onNext` and silently recenter
 * the scroll position so the dance can repeat indefinitely.
 *
 * Scrollbars are hidden. Vertical scrolling inside `children` is untouched.
 */
export function SwipePager({
  enabled,
  onPrev,
  onNext,
  children,
  resetKey,
}: {
  enabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  children: React.ReactNode;
  /**
   * Bump this whenever the content changes underneath us (e.g. date moved via
   * keyboard / chevrons) so the pager recenters without animation.
   */
  resetKey?: string | number;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const settlingRef = useRef(false);
  const idleTimerRef = useRef<number | null>(null);

  // Recenter helper – jumps instantly to the middle pane.
  const recenter = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const prev = el.style.scrollBehavior;
    el.style.scrollBehavior = "auto";
    el.scrollLeft = el.clientWidth;
    // Force reflow, then restore.
    void el.offsetWidth;
    el.style.scrollBehavior = prev;
  }, []);

  // Centre on mount / when enabled toggles on / after external date change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey is a prop whose identity deliberately triggers recentering.
  useEffect(() => {
    if (!enabled) return;
    recenter();
  }, [enabled, resetKey, recenter]);

  useEffect(() => {
    if (!enabled) return;
    const el = scrollerRef.current;
    if (!el) return;

    const commit = () => {
      if (settlingRef.current) return;
      const w = el.clientWidth;
      const x = el.scrollLeft;
      // Tolerance: within 5% of pane boundary counts as settled.
      const tol = Math.max(8, w * 0.05);
      if (x < w - tol) {
        // Landed on prev pane.
        settlingRef.current = true;
        onPrev();
        // Defer recenter past React commit so new content is in place.
        requestAnimationFrame(() => {
          recenter();
          settlingRef.current = false;
        });
      } else if (x > w + tol) {
        settlingRef.current = true;
        onNext();
        requestAnimationFrame(() => {
          recenter();
          settlingRef.current = false;
        });
      }
      // else: stayed on center – nothing to do.
    };

    const onScrollEnd = () => commit();
    const onScroll = () => {
      if (idleTimerRef.current != null) {
        window.clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = window.setTimeout(commit, 140);
    };

    // Prefer native scrollend where available; fall back to a debounced scroll.
    const supportsScrollEnd = "onscrollend" in el;
    const target = el as HTMLElement;
    if (supportsScrollEnd) {
      target.addEventListener("scrollend", onScrollEnd);
    } else {
      target.addEventListener("scroll", onScroll, { passive: true });
    }

    return () => {
      if (supportsScrollEnd)
        target.removeEventListener("scrollend", onScrollEnd);
      else target.removeEventListener("scroll", onScroll);
      if (idleTimerRef.current != null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [enabled, onPrev, onNext, recenter]);

  if (!enabled) {
    return (
      <div className="flex-1 min-h-0 min-w-0 flex flex-col">{children}</div>
    );
  }

  return (
    <div
      ref={scrollerRef}
      className="flex-1 min-h-0 min-w-0 overflow-x-auto overscroll-x-contain swipe-pager-scroller"
      style={{
        scrollSnapType: "x mandatory",
        scrollbarWidth: "none",
      }}
    >
      <div
        className="flex"
        style={{ width: "300%", height: "100%", minHeight: 0 }}
      >
        <div
          aria-hidden
          className="shrink-0"
          style={{
            width: "33.3333%",
            height: "100%",
            scrollSnapAlign: "start",
          }}
        />
        <div
          className="shrink-0 min-w-0 flex flex-col"
          style={{
            width: "33.3333%",
            height: "100%",
            minHeight: 0,
            scrollSnapAlign: "start",
          }}
        >
          {children}
        </div>
        <div
          aria-hidden
          className="shrink-0"
          style={{
            width: "33.3333%",
            height: "100%",
            scrollSnapAlign: "start",
          }}
        />
      </div>
    </div>
  );
}
