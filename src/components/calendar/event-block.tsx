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
  continuation,
}: {
  task: Task;
  column: number;
  totalColumns: number;
  categoryColor?: string;
  onClick: (task: Task) => void;
  isDragging?: boolean;
  continuation?: "start" | "end";
}) {
  const start = task.startAt ? new Date(task.startAt) : null;
  const end = task.endAt ? new Date(task.endAt) : null;
  if (!start) return null;

  let startMin: number;
  let endMin: number;

  if (continuation === "end") {
    startMin = 0;
    endMin = end ? getMinutesFromMidnight(end) : 60;
  } else if (continuation === "start") {
    startMin = getMinutesFromMidnight(start);
    endMin = 1440;
  } else {
    startMin = getMinutesFromMidnight(start);
    endMin = end ? getMinutesFromMidnight(end) : startMin + 15;
  }

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
      className={`absolute z-10 overflow-hidden px-1.5 py-0.5 text-[10px] leading-tight border-l-2 transition-colors hover:brightness-90 cursor-pointer text-left flex flex-col justify-start ${statusColor(task)} ${isDragging ? "opacity-20" : ""}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        backgroundColor: categoryColor ? `${categoryColor}20` : "var(--accent)",
        borderLeftColor: categoryColor || "var(--primary)",
        ...(continuation === "end" ? { borderTop: "none" } : {}),
        ...(continuation === "start" ? { borderBottom: "none" } : {}),
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <span className="font-medium truncate block">{task.description}</span>
      <span className="truncate block text-muted-foreground">
        {formatTime(start)}
        {end ? `\u2013${formatTime(end)}` : ""}
      </span>
      {task.location && (
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
        data-resize-handle-top=""
        className="absolute top-0 left-0 right-0 cursor-ns-resize"
        style={{ height: "8px" }}
      />
      <div
        data-resize-handle=""
        className="absolute bottom-0 left-0 right-0 cursor-ns-resize"
        style={{ height: "8px" }}
      />
      <div
        data-drag-handle-left=""
        className="absolute top-0 bottom-0 left-0 cursor-ew-resize"
        style={{ width: "6px" }}
      />
      <div
        data-drag-handle-right=""
        className="absolute top-0 bottom-0 right-0 cursor-ew-resize"
        style={{ width: "6px" }}
      />
    </button>
  );
}
