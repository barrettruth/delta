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
  isDragging,
}: {
  task: Task;
  column: number;
  totalColumns: number;
  categoryColor?: string;
  onClick: (task: Task) => void;
  isDragging?: boolean;
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
      data-event-id={task.id}
      data-event-start={task.startAt}
      data-event-end={task.endAt ?? ""}
      data-event-start-min={startMin}
      data-event-end-min={endMin}
      className={`absolute z-10 overflow-hidden px-1.5 py-0.5 text-[10px] leading-tight border-l-2 transition-colors hover:brightness-90 cursor-pointer ${statusColor(task)} ${isDragging ? "opacity-20" : ""}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        backgroundColor: categoryColor ? `${categoryColor}20` : "var(--accent)",
        borderLeftColor: categoryColor || "var(--primary)",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick(task);
      }}
    >
      <span className="font-medium truncate block">{task.description}</span>
      <span className="truncate block">
        {formatTime(start)}
        {end ? `\u2013${formatTime(end)}` : ""}
      </span>
      {task.location && height >= 30 && (
        <span className="truncate block text-[9px] text-muted-foreground">
          {task.location}
        </span>
      )}
      {task.meetingUrl && height >= 45 && (
        <a
          href={task.meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-[9px] text-muted-foreground underline hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          {"↗"}
        </a>
      )}
      <div
        data-resize-handle=""
        className="absolute bottom-0 left-0 right-0 cursor-ns-resize"
        style={{ height: "8px" }}
      />
    </button>
  );
}
