"use client";

import { useMemo } from "react";
import type { Task } from "@/core/types";
import { addDays } from "@/lib/calendar-utils";

const MAX_COLLAPSED_ROWS = 3;

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
      rows.push([span]);
    }
  }

  return rows;
}

export function AllDayBar({
  weekStart,
  allDayTasks,
  expanded,
  categoryColors,
  onTaskClick,
}: {
  weekStart: Date;
  allDayTasks: Task[];
  expanded: boolean;
  categoryColors: Record<string, string>;
  onTaskClick: (task: Task) => void;
}) {
  const spans = useMemo(
    () => computeSpans(allDayTasks, weekStart),
    [allDayTasks, weekStart],
  );

  const rows = useMemo(() => layoutRows(spans), [spans]);

  if (rows.length === 0) return null;

  const visibleRows = expanded ? rows : rows.slice(0, MAX_COLLAPSED_ROWS);
  const hiddenCount = expanded
    ? 0
    : Math.max(0, rows.length - MAX_COLLAPSED_ROWS);
  const rowHeight = 22;

  return (
    <div className="border-b border-border/60 shrink-0 overflow-x-auto">
      <div
        className="grid"
        style={{
          gridTemplateColumns: "3rem repeat(7, 1fr)",
          minWidth: "640px",
        }}
      >
        <div className="py-1 text-[10px] text-muted-foreground text-right pr-2 flex items-end">
          {hiddenCount > 0 && <span>+{hiddenCount}</span>}
        </div>
        <div
          className="col-span-7 relative"
          style={{ height: `${visibleRows.length * rowHeight}px` }}
        >
          {visibleRows.map((row, rowIdx) =>
            row.map((span) => {
              const color = span.task.category
                ? categoryColors[span.task.category]
                : undefined;
              return (
                <button
                  type="button"
                  key={span.task.id}
                  className="absolute text-[10px] leading-tight truncate px-1.5 py-0.5 border border-border/30 hover:brightness-90 transition-colors cursor-pointer"
                  style={{
                    top: `${rowIdx * rowHeight}px`,
                    height: `${rowHeight - 2}px`,
                    left: `${(span.startCol / 7) * 100}%`,
                    width: `${((span.endCol - span.startCol + 1) / 7) * 100}%`,
                    backgroundColor: color ? `${color}20` : "var(--accent)",
                    borderLeftColor: color || "var(--primary)",
                    borderLeftWidth: "2px",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTaskClick(span.task);
                  }}
                >
                  {span.task.description}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
