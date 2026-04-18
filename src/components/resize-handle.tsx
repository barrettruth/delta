"use client";

import { useCallback } from "react";
import { MAX_WIDTH_PCT, MIN_WIDTH_PCT } from "@/contexts/task-panel";

export function ResizeHandle({
  onResize,
  onResizeEnd,
}: {
  onResize: (widthPct: number) => void;
  onResizeEnd?: () => void;
}) {
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();

      const viewportWidth = window.innerWidth;

      const onMove = (moveE: PointerEvent) => {
        const pct = ((viewportWidth - moveE.clientX) / viewportWidth) * 100;
        const clamped = Math.max(MIN_WIDTH_PCT, Math.min(MAX_WIDTH_PCT, pct));
        onResize(clamped);
      };

      const onUp = () => {
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
      className="w-1 shrink-0 bg-card hover:bg-border cursor-col-resize transition-colors"
      onPointerDown={handlePointerDown}
    />
  );
}
