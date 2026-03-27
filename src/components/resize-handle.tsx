"use client";

import { useCallback, useRef } from "react";
import { MAX_WIDTH_PCT, MIN_WIDTH_PCT } from "@/contexts/task-panel";

export function ResizeHandle({
  onResize,
  onResizeEnd,
}: {
  onResize: (widthPct: number) => void;
  onResizeEnd?: () => void;
}) {
  const draggingRef = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      draggingRef.current = true;

      const container = (e.target as HTMLElement).parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      const onMove = (moveE: PointerEvent) => {
        const pct = ((rect.right - moveE.clientX) / rect.width) * 100;
        const clamped = Math.max(MIN_WIDTH_PCT, Math.min(MAX_WIDTH_PCT, pct));
        onResize(clamped);
      };

      const onUp = () => {
        draggingRef.current = false;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        onResizeEnd?.();
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [onResize, onResizeEnd],
  );

  return (
    <div
      className="w-1 shrink-0 bg-transparent hover:bg-accent/50 cursor-col-resize transition-colors"
      onPointerDown={handlePointerDown}
    />
  );
}
