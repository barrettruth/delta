"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Task } from "@/core/types";
import { addDays } from "@/lib/calendar-utils";

const MAX_COLLAPSED_ROWS = 3;
const MAX_EXPANDED_ROWS = 6;
const MAX_LAYOUT_ROWS = 20;
const DRAG_THRESHOLD = 5;

interface AllDaySpan {
  task: Task;
  startCol: number;
  endCol: number;
}

function computeSpans(allDayTasks: Task[], weekStart: Date): AllDaySpan[] {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) days.push(addDays(weekStart, i));

  const spans: AllDaySpan[] = [];
  for (const task of allDayTasks) {
    const taskDate = task.startAt ? new Date(task.startAt) : null;
    if (!taskDate) continue;

    const endDate = task.endAt ? new Date(task.endAt) : taskDate;

    let startCol = -1;
    let endCol = -1;

    for (let i = 0; i < 7; i++) {
      const dayStart = new Date(days[i]);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(days[i]);
      dayEnd.setHours(23, 59, 59, 999);

      const taskStart = new Date(taskDate);
      taskStart.setHours(0, 0, 0, 0);
      const taskEnd = new Date(endDate);
      taskEnd.setHours(23, 59, 59, 999);

      if (taskStart <= dayEnd && taskEnd >= dayStart) {
        if (startCol === -1) startCol = i;
        endCol = i;
      }
    }

    if (startCol !== -1) {
      spans.push({ task, startCol, endCol });
    }
  }

  return spans;
}

function layoutRows(spans: AllDaySpan[]): AllDaySpan[][] {
  const rows: AllDaySpan[][] = [];
  const sorted = [...spans].sort((a, b) => {
    const spanA = a.endCol - a.startCol;
    const spanB = b.endCol - b.startCol;
    if (spanB !== spanA) return spanB - spanA;
    return a.startCol - b.startCol;
  });

  for (const span of sorted) {
    if (rows.length >= MAX_LAYOUT_ROWS) break;
    let placed = false;
    for (const row of rows) {
      const overlaps = row.some(
        (s) => s.startCol <= span.endCol && s.endCol >= span.startCol,
      );
      if (!overlaps) {
        row.push(span);
        placed = true;
        break;
      }
    }
    if (!placed) {
      if (rows.length < MAX_LAYOUT_ROWS) {
        rows.push([span]);
      }
    }
  }

  return rows;
}

function computePerDayHidden(
  rows: AllDaySpan[][],
  visibleRowCount: number,
): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (let r = visibleRowCount; r < rows.length; r++) {
    for (const span of rows[r]) {
      for (let col = span.startCol; col <= span.endCol; col++) {
        counts[col]++;
      }
    }
  }
  return counts;
}

export function AllDayBar({
  weekStart,
  allDayTasks,
  expanded,
  categoryColors,
  onTaskClick,
  onAllDayMove,
}: {
  weekStart: Date;
  allDayTasks: Task[];
  expanded: boolean;
  categoryColors: Record<string, string>;
  onTaskClick: (task: Task) => void;
  onAllDayMove?: (taskId: number, dayOffset: number) => void;
}) {
  const spans = useMemo(
    () => computeSpans(allDayTasks, weekStart),
    [allDayTasks, weekStart],
  );

  const rows = useMemo(() => layoutRows(spans), [spans]);

  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const dragRef = useRef({
    taskId: null as number | null,
    startCol: 0,
    endCol: 0,
    startX: 0,
    didDrag: false,
    colWidth: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, span: AllDaySpan) => {
      if (e.button !== 0) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const container = containerRef.current;
      if (!container) return;
      const colWidth = container.offsetWidth / 7;

      dragRef.current = {
        taskId: span.task.id,
        startCol: span.startCol,
        endCol: span.endCol,
        startX: e.clientX,
        didDrag: false,
        colWidth,
      };
    },
    [],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (d.taskId === null) return;

    const dx = e.clientX - d.startX;
    if (!d.didDrag && Math.abs(dx) < DRAG_THRESHOLD) return;

    if (!d.didDrag) {
      d.didDrag = true;
      setDraggingId(d.taskId);
    }

    const colOffset = Math.round(dx / d.colWidth);
    const clampedOffset = Math.max(
      -d.startCol,
      Math.min(6 - d.endCol, colOffset),
    );
    setDragOffset(clampedOffset);
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}

      const d = dragRef.current;
      const wasDrag = d.didDrag;
      const taskId = d.taskId;
      const offset = Math.round((e.clientX - d.startX) / d.colWidth);
      const clampedOffset =
        d.taskId !== null
          ? Math.max(-d.startCol, Math.min(6 - d.endCol, offset))
          : 0;

      dragRef.current.taskId = null;
      dragRef.current.didDrag = false;
      setDraggingId(null);
      setDragOffset(0);

      if (!wasDrag && taskId !== null) {
        const task = allDayTasks.find((t) => t.id === taskId);
        if (task) onTaskClick(task);
        return;
      }

      if (wasDrag && taskId !== null && clampedOffset !== 0) {
        onAllDayMove?.(taskId, clampedOffset);
      }
    },
    [allDayTasks, onTaskClick, onAllDayMove],
  );

  if (rows.length === 0) return null;

  const maxVisible = expanded ? MAX_EXPANDED_ROWS : MAX_COLLAPSED_ROWS;
  const visibleRows = rows.slice(0, maxVisible);
  const hasOverflow = rows.length > maxVisible;
  const hiddenPerDay = hasOverflow
    ? computePerDayHidden(rows, maxVisible)
    : null;
  const rowHeight = 22;
  const badgeHeight = hasOverflow ? 16 : 0;
  const contentHeight = visibleRows.length * rowHeight + badgeHeight;
  const needsScroll = expanded && rows.length > MAX_EXPANDED_ROWS;

  return (
    <div className="border-b border-border/60 shrink-0 overflow-x-auto">
      <div
        className="grid"
        style={{
          gridTemplateColumns: "3rem repeat(7, 1fr)",
          minWidth: "640px",
        }}
      >
        <div />
        <div
          ref={containerRef}
          className="col-span-7 relative"
          style={
            needsScroll
              ? {
                  height: `${MAX_EXPANDED_ROWS * rowHeight + badgeHeight}px`,
                  overflowY: "auto",
                }
              : { height: `${contentHeight}px` }
          }
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {visibleRows.map((row, rowIdx) =>
            row.map((span) => {
              const color = span.task.category
                ? categoryColors[span.task.category]
                : undefined;
              const isDragging = span.task.id === draggingId;
              const offsetCols = isDragging ? dragOffset : 0;
              const startCol = span.startCol + offsetCols;
              const endCol = span.endCol + offsetCols;
              return (
                <button
                  type="button"
                  key={span.task.id}
                  className={`absolute text-[10px] leading-tight truncate px-1.5 py-0.5 border border-border/30 hover:brightness-90 transition-colors cursor-pointer text-left ${isDragging ? "opacity-70 z-20" : ""}`}
                  style={{
                    top: `${rowIdx * rowHeight}px`,
                    height: `${rowHeight - 2}px`,
                    left: `${(startCol / 7) * 100}%`,
                    width: `${((endCol - startCol + 1) / 7) * 100}%`,
                    backgroundColor: color ? `${color}20` : "var(--accent)",
                    borderLeftColor: color || "var(--primary)",
                    borderLeftWidth: "2px",
                  }}
                  onPointerDown={(e) => handlePointerDown(e, span)}
                >
                  {span.task.description}
                </button>
              );
            }),
          )}
          {hiddenPerDay && (
            <div
              className="absolute left-0 right-0 flex"
              style={{ top: `${visibleRows.length * rowHeight}px` }}
            >
              {hiddenPerDay.map((count, col) => (
                <div
                  key={col}
                  className="flex-1 text-center text-[10px] text-muted-foreground leading-[16px]"
                >
                  {count > 0 ? `+${count}` : ""}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
