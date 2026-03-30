"use client";

import { MapPinSimple, VideoCamera, X } from "@phosphor-icons/react";
import type { Task } from "@/core/types";
import type { Continuation } from "@/lib/calendar-utils";
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
  onDelete,
  isDragging,
  continuation,
  overrideStartMin,
  overrideEndMin,
  isRecurring,
}: {
  task: Task;
  column: number;
  totalColumns: number;
  categoryColor?: string;
  onDelete?: (task: Task) => void;
  isDragging?: boolean;
  continuation?: Continuation;
  overrideStartMin?: number;
  overrideEndMin?: number;
  isRecurring?: boolean;
}) {
  const start = task.startAt ? new Date(task.startAt) : null;
  const end = task.endAt ? new Date(task.endAt) : null;
  if (!start) return null;

  let startMin: number;
  let endMin: number;

  if (overrideStartMin !== undefined && overrideEndMin !== undefined) {
    startMin = overrideStartMin;
    endMin = overrideEndMin;
  } else if (continuation === "end") {
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
      className={`group/event absolute z-10 overflow-hidden ${height < 25 ? "px-1 py-0" : "px-1.5 py-1"} text-[10px] leading-tight border-l-2 transition-colors hover:brightness-90 cursor-pointer text-left ${height < 25 ? "flex items-center justify-between gap-1" : "flex flex-col gap-0.5 justify-start"} ${statusColor(task)} ${isDragging ? "opacity-20" : ""}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        backgroundColor: categoryColor ? `${categoryColor}20` : "var(--accent)",
        borderLeftColor: categoryColor || "var(--primary)",
        ...(continuation === "end" || continuation === "middle"
          ? { borderTop: "none" }
          : {}),
        ...(continuation === "start" || continuation === "middle"
          ? { borderBottom: "none" }
          : {}),
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {height < 25 ? (
        <>
          <span className="font-medium truncate text-[10px] inline-flex items-center min-w-0">
            {isRecurring && <span className="mr-0.5 shrink-0">&#x21BB;</span>}
            <span className="truncate">{task.description}</span>
          </span>
          <span className="shrink-0 text-muted-foreground text-[9px] inline-flex items-center">
            {formatTime(start)}
          </span>
        </>
      ) : (
        <>
          <span className="font-medium truncate flex items-center gap-0.5 text-[11px]">
            {isRecurring && (
              <span
                className="mr-0.5 shrink-0"
                role="img"
                aria-label="recurring"
              >
                &#x21BB;
              </span>
            )}
            <span className="truncate">{task.description}</span>
            {height < 40 && task.location && (
              <MapPinSimple className="w-2.5 h-2.5 shrink-0 text-muted-foreground" />
            )}
            {height < 45 && task.meetingUrl && (
              <VideoCamera className="w-2.5 h-2.5 shrink-0 text-muted-foreground" />
            )}
          </span>
          {height >= 30 && (
            <span className="truncate block text-muted-foreground">
              {formatTime(start)}
              {end ? `\u2013${formatTime(end)}` : ""}
            </span>
          )}
          {height >= 40 && task.location && (
            <span className="truncate flex items-center gap-0.5 text-[9px] text-muted-foreground">
              <MapPinSimple className="w-2.5 h-2.5 shrink-0" />
              {task.location}
            </span>
          )}
          {height >= 45 && task.meetingUrl && (
            <a
              href={task.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <VideoCamera className="w-2.5 h-2.5 shrink-0" />
            </a>
          )}
        </>
      )}
      {onDelete && (
        <div
          role="button"
          tabIndex={-1}
          className="absolute top-0 right-0 z-20 p-0.5 opacity-0 group-hover/event:opacity-100 transition-opacity hover:text-destructive"
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
              onDelete(task);
            }
          }}
        >
          <X className="w-3 h-3" />
        </div>
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
    </button>
  );
}
