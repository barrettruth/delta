"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/**
 * Horizontal swipe pager for the calendar.
 *
 * Renders three panes side-by-side (prev / current / next) inside a
 * translateX-animated track. The user drags horizontally with a pointer; the
 * neighbor pane peeks in from the side in real time. On release:
 *
 *   - if |delta| > commitThreshold * paneWidth, animate to the neighbor and
 *     call onCommit("prev" | "next"). The parent updates its anchor state,
 *     which causes us to re-render with freshly dated panes; we then snap the
 *     track back to center without animation so the illusion is seamless.
 *   - otherwise, animate back to center.
 *
 * Vertical scrolling inside children is preserved: we only capture pointer
 * events once the gesture is clearly horizontal (|dx| > |dy| after a small
 * threshold). Touch works via pointer events with `touch-action: pan-y` so the
 * browser hands horizontal intent to us without waiting for a scroll.
 *
 * No browser scrollbars are used, horizontally or vertically — all motion is
 * pure CSS transform.
 */

const ACTIVATION_PX = 8;
const DEFAULT_COMMIT_FRACTION = 1; // whole pane = one commit unit
const SNAP_MS = 240;

interface PaneProps {
  date: Date;
  /** true for the center pane. The parent should attach its fcRef here. */
  isCenter: boolean;
}

interface SwipePagerProps {
  enabled: boolean;
  anchor: Date;
  /** "day" or "week" — determines how neighbor dates are offset. */
  unit: "day" | "week";
  /**
   * Fraction of the pane width that constitutes one "commit unit". Commit
   * threshold is half this. E.g. 1/7 means "half a day-column of travel" in a
   * week view that shows 7 days per pane.
   */
  commitFraction?: number;
  onCommit: (direction: "prev" | "next") => void;
  renderPane: (props: PaneProps) => React.ReactNode;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function neighborDate(
  anchor: Date,
  unit: "day" | "week",
  offset: -1 | 1,
): Date {
  return addDays(anchor, offset * (unit === "week" ? 7 : 1));
}

export function SwipePager({
  enabled,
  anchor,
  unit,
  commitFraction = DEFAULT_COMMIT_FRACTION,
  onCommit,
  renderPane,
}: SwipePagerProps) {
  // Commit when the user has travelled more than half a commit-unit.
  const commitThreshold = commitFraction / 2;
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Width of one pane (== viewport width). Measured imperatively.
  const paneWidthRef = useRef(0);

  // Active drag state (refs so we don't re-render during the drag).
  const dragging = useRef(false);
  const pointerId = useRef<number | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const activated = useRef(false);
  const lastDx = useRef(0);

  // Small state bump to re-render after a commit so neighbor dates refresh.
  const [, forceTick] = useState(0);
  // Pixel-exact pane width tracked via ResizeObserver so flex sub-pixel
  // rounding can't create hairline gaps between adjacent panes.
  const [paneWidthPx, setPaneWidthPx] = useState(0);

  // Measure pane width and set initial transform to -1 * paneWidth (center).
  const recenter = useCallback((animated: boolean) => {
    const vp = viewportRef.current;
    const track = trackRef.current;
    if (!vp || !track) return;
    const w = vp.clientWidth;
    paneWidthRef.current = w;
    track.style.transition = animated
      ? `transform ${SNAP_MS}ms ease-out`
      : "none";
    track.style.transform = `translate3d(${-w}px, 0, 0)`;
  }, []);

  useLayoutEffect(() => {
    recenter(false);
  }, [recenter]);

  // Recenter + re-measure pane width on resize.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const ro = new ResizeObserver(() => {
      setPaneWidthPx(vp.clientWidth);
      recenter(false);
    });
    ro.observe(vp);
    setPaneWidthPx(vp.clientWidth);
    return () => ro.disconnect();
  }, [recenter]);

  // When anchor changes externally (keyboard nav, chevron, today), neighbors
  // update via re-render — make sure the track is centered with no animation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: anchor is the external trigger whose identity deliberately causes recentering.
  useLayoutEffect(() => {
    if (!enabled) return;
    recenter(false);
  }, [enabled, anchor, recenter]);

  // --- Pointer handling --------------------------------------------------

  // Query center pane's axis cells so we can counter-translate them while the
  // track moves (making the time axis appear pinned).
  const getAxisEls = useCallback((): HTMLElement[] => {
    const track = trackRef.current;
    if (!track) return [];
    const center = track.querySelector<HTMLElement>(".fc-center-pane");
    if (!center) return [];
    // Counter-translate whole axis cells so both the background (which masks
    // sliding content) and the cushion text move together.
    const sel =
      ".fc-timegrid-axis, .fc-timegrid-slot-label, " +
      ".fc-col-header-cell.fc-timegrid-axis";
    return Array.from(center.querySelectorAll<HTMLElement>(sel));
  }, []);

  const setTransform = useCallback(
    (px: number, animated: boolean) => {
      const track = trackRef.current;
      if (!track) return;
      const transition = animated ? `transform ${SNAP_MS}ms ease-out` : "none";
      const w = paneWidthRef.current || track.clientWidth / 3;
      // Current drag offset (px is -w at rest, -w+dx while dragging).
      const dx = px - -w;
      track.style.transition = transition;
      track.style.transform = `translate3d(${px}px, 0, 0)`;
      // Counter-translate the center pane's axis text so it stays put.
      const counter = `translate3d(${-dx}px, 0, 0)`;
      for (const el of getAxisEls()) {
        el.style.transition = transition;
        el.style.transform = counter;
        el.style.willChange = "transform";
      }
    },
    [getAxisEls],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      // Only primary mouse button / touches / pen.
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragging.current = true;
      pointerId.current = e.pointerId;
      startX.current = e.clientX;
      startY.current = e.clientY;
      activated.current = false;
      lastDx.current = 0;
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current || pointerId.current !== e.pointerId) return;
      const dx = e.clientX - startX.current;
      const dy = e.clientY - startY.current;

      if (!activated.current) {
        // Haven't committed to a horizontal gesture yet.
        if (Math.abs(dx) < ACTIVATION_PX && Math.abs(dy) < ACTIVATION_PX)
          return;
        if (Math.abs(dy) > Math.abs(dx)) {
          // Vertical intent: abort, let FC's inner scroll handle it.
          dragging.current = false;
          pointerId.current = null;
          return;
        }
        activated.current = true;
        // Capture so subsequent moves come to us even over child elements.
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }

      lastDx.current = dx;
      const w = paneWidthRef.current || (viewportRef.current?.clientWidth ?? 0);
      setTransform(-w + dx, false);
      e.preventDefault();
    },
    [setTransform],
  );

  const finishDrag = useCallback(() => {
    dragging.current = false;
    pointerId.current = null;

    if (!activated.current) return;
    activated.current = false;

    const w = paneWidthRef.current || (viewportRef.current?.clientWidth ?? 1);
    const dx = lastDx.current;
    const ratio = dx / w;

    if (ratio <= -commitThreshold) {
      // Committed to NEXT pane — animate to -2w, then reset after anchor updates.
      setTransform(-2 * w, true);
      window.setTimeout(() => {
        onCommit("next");
        // After onCommit, the parent re-renders with a new anchor and the panes
        // shift (old next becomes new center). We force a recenter to -w
        // without animation on next frame.
        requestAnimationFrame(() => {
          recenter(false);
          forceTick((n) => n + 1);
        });
      }, SNAP_MS);
    } else if (ratio >= commitThreshold) {
      setTransform(0, true);
      window.setTimeout(() => {
        onCommit("prev");
        requestAnimationFrame(() => {
          recenter(false);
          forceTick((n) => n + 1);
        });
      }, SNAP_MS);
    } else {
      // Snap back.
      setTransform(-w, true);
    }
  }, [onCommit, recenter, setTransform, commitThreshold]);

  const onPointerUp = useCallback(() => {
    finishDrag();
  }, [finishDrag]);

  const onPointerCancel = useCallback(() => {
    finishDrag();
  }, [finishDrag]);

  // --- Wheel (trackpad) handling -----------------------------------------
  //
  // Treat horizontal wheel deltas as a continuous pan. When the user stops
  // delivering deltas for WHEEL_IDLE_MS, run the commit-or-snapback decision.
  const wheelDx = useRef(0);
  const wheelActive = useRef(false);
  const wheelIdleTimer = useRef<number | null>(null);
  const WHEEL_IDLE_MS = 140;

  const finishWheel = useCallback(() => {
    if (!wheelActive.current) return;
    wheelActive.current = false;
    const w = paneWidthRef.current || (viewportRef.current?.clientWidth ?? 1);
    const dx = wheelDx.current;
    wheelDx.current = 0;
    const ratio = dx / w;

    if (ratio <= -commitThreshold) {
      setTransform(-2 * w, true);
      window.setTimeout(() => {
        onCommit("next");
        requestAnimationFrame(() => {
          recenter(false);
          forceTick((n) => n + 1);
        });
      }, SNAP_MS);
    } else if (ratio >= commitThreshold) {
      setTransform(0, true);
      window.setTimeout(() => {
        onCommit("prev");
        requestAnimationFrame(() => {
          recenter(false);
          forceTick((n) => n + 1);
        });
      }, SNAP_MS);
    } else {
      setTransform(-w, true);
    }
  }, [onCommit, recenter, setTransform, commitThreshold]);

  useEffect(() => {
    if (!enabled) return;
    const vp = viewportRef.current;
    if (!vp) return;

    const onWheel = (e: WheelEvent) => {
      // Only hijack when horizontal intent dominates. Trackpad horizontal
      // swipe emits |deltaX| >> |deltaY|; regular mouse wheel sends deltaY.
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();

      if (!wheelActive.current) {
        wheelActive.current = true;
        wheelDx.current = 0;
      }
      // Wheel deltaX is positive when panning content to the LEFT (i.e. the
      // user is moving to the NEXT period). Our transform dx is positive for
      // panning right, so invert.
      wheelDx.current -= e.deltaX;

      const w = paneWidthRef.current || vp.clientWidth;
      // Clamp to [-w, w] so the user can't overscroll past a neighbor.
      const clamped = Math.max(-w, Math.min(w, wheelDx.current));
      wheelDx.current = clamped;
      setTransform(-w + clamped, false);

      if (wheelIdleTimer.current != null) {
        window.clearTimeout(wheelIdleTimer.current);
      }
      wheelIdleTimer.current = window.setTimeout(finishWheel, WHEEL_IDLE_MS);
    };

    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      vp.removeEventListener("wheel", onWheel);
      if (wheelIdleTimer.current != null) {
        window.clearTimeout(wheelIdleTimer.current);
        wheelIdleTimer.current = null;
      }
    };
  }, [enabled, finishWheel, setTransform]);

  // --- Render ------------------------------------------------------------

  if (!enabled) {
    return (
      <div className="flex-1 min-h-0 min-w-0 flex flex-col">
        {renderPane({ date: anchor, isCenter: true })}
      </div>
    );
  }

  const prev = neighborDate(anchor, unit, -1);
  const next = neighborDate(anchor, unit, 1);

  return (
    <div
      ref={viewportRef}
      className="flex-1 min-h-0 min-w-0 relative overflow-hidden"
      style={{ touchAction: "pan-y" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div
        ref={trackRef}
        className="flex h-full"
        style={{
          width: paneWidthPx ? `${paneWidthPx * 3}px` : "300%",
          willChange: "transform",
        }}
      >
        <Pane widthPx={paneWidthPx}>
          {renderPane({ date: prev, isCenter: false })}
        </Pane>
        <Pane widthPx={paneWidthPx} center>
          {renderPane({ date: anchor, isCenter: true })}
        </Pane>
        <Pane widthPx={paneWidthPx}>
          {renderPane({ date: next, isCenter: false })}
        </Pane>
      </div>
    </div>
  );
}

function Pane({
  children,
  center,
  widthPx,
}: {
  children: React.ReactNode;
  center?: boolean;
  widthPx: number;
}) {
  return (
    <div
      className={`min-w-0 flex flex-col${center ? " fc-center-pane" : ""}`}
      style={{
        width: widthPx ? `${widthPx}px` : undefined,
        flex: widthPx ? undefined : "1 0 0",
        height: "100%",
        minHeight: 0,
      }}
    >
      {children}
    </div>
  );
}
