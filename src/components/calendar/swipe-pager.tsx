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
 *   - if |delta| > COMMIT_THRESHOLD * paneWidth, animate to the neighbor and
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
const COMMIT_THRESHOLD = 0.22; // fraction of pane width needed to commit
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
  onCommit,
  renderPane,
}: SwipePagerProps) {
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

  // Recenter on resize.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const ro = new ResizeObserver(() => recenter(false));
    ro.observe(vp);
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

  const setTransform = useCallback((px: number, animated: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition = animated
      ? `transform ${SNAP_MS}ms ease-out`
      : "none";
    track.style.transform = `translate3d(${px}px, 0, 0)`;
  }, []);

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

    if (ratio <= -COMMIT_THRESHOLD) {
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
    } else if (ratio >= COMMIT_THRESHOLD) {
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
  }, [onCommit, recenter, setTransform]);

  const onPointerUp = useCallback(() => {
    finishDrag();
  }, [finishDrag]);

  const onPointerCancel = useCallback(() => {
    finishDrag();
  }, [finishDrag]);

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
        style={{ width: "300%", willChange: "transform" }}
      >
        <Pane>{renderPane({ date: prev, isCenter: false })}</Pane>
        <Pane>{renderPane({ date: anchor, isCenter: true })}</Pane>
        <Pane>{renderPane({ date: next, isCenter: false })}</Pane>
      </div>
    </div>
  );
}

function Pane({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="shrink-0 min-w-0 flex flex-col"
      style={{ width: "33.3333%", height: "100%", minHeight: 0 }}
    >
      {children}
    </div>
  );
}
