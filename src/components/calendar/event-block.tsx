"use client";

import type { Task } from "@/core/types";
import {
  formatTime,
  getMinutesFromMidnight,
  HOUR_HEIGHT,
  statusColor,
} from "@/lib/calendar-utils";

export function EventBlock({
  task,
  column,
  totalColumns,
  categoryColor,
  onClick,
}: {
  task: Task;
  column: number;
  totalColumns: number;
  categoryColor?: string;
  onClick: (task: Task) => void;
}) {
  const start = task.startAt ? new Date(task.startAt) : null;
  const end = task.endAt ? new Date(task.endAt) : null;
  if (!start) return null;

  const startMin = getMinutesFromMidnight(start);
  const endMin = end ? getMinutesFromMidnight(end) : startMin + 15;
  const durationMin = Math.max(endMin - startMin, 15);

  const pxPerMin = HOUR_HEIGHT / 60;
  const top = startMin * pxPerMin;
  const height = durationMin * pxPerMin;

  const widthPct = 100 / totalColumns;
  const leftPct = column * widthPct;

  return (
    <button
      type="button"
      className={`absolute overflow-hidden px-1.5 py-0.5 text-[10px] leading-tight border-l-2 transition-colors hover:brightness-90 cursor-pointer ${statusColor(task)}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        backgroundColor: categoryColor ? `${categoryColor}20` : "var(--accent)",
        borderLeftColor: categoryColor || "var(--primary)",
      }}
      onClick={() => onClick(task)}
    >
      <span className="font-medium truncate block">
        {formatTime(start)}
        {end ? `\u2013${formatTime(end)}` : ""}
      </span>
      <span className="truncate block">{task.description}</span>
    </button>
  );
}
