"use client";

import type { EventContentArg } from "@fullcalendar/core";
import { MapPinSimple, VideoCamera } from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { TaskSourceIndicator } from "@/components/task-source-indicator";
import type { Task } from "@/core/types";

type CalendarEventStyle = CSSProperties & {
  "--delta-calendar-event-border"?: string;
};

function eventBorderStyle(borderColor: string): CalendarEventStyle | undefined {
  if (!borderColor) return undefined;
  return {
    "--delta-calendar-event-border": borderColor,
  };
}

export function renderCalendarEventContent(arg: EventContentArg) {
  const task = arg.event.extendedProps.task as Task | undefined;
  const isRecurring = Boolean(arg.event.extendedProps.isRecurring);
  const calendarBorderColor = arg.event.extendedProps.calendarBorderColor;
  const isDoneOrCancelled =
    task?.status === "done" || task?.status === "cancelled";
  const titleClass = isDoneOrCancelled ? "line-through" : "";

  return (
    <div
      className="fc-delta-event-inner"
      style={
        typeof calendarBorderColor === "string"
          ? eventBorderStyle(calendarBorderColor)
          : undefined
      }
    >
      <div className="fc-delta-event-title">
        {isRecurring && (
          <span className="fc-delta-recur" role="img" aria-label="recurring">
            {"\u21BB"}
          </span>
        )}
        <span className={`fc-delta-title-text ${titleClass}`}>
          {arg.event.title}
        </span>
        <TaskSourceIndicator
          source={task?.sourceInfo}
          className="fc-delta-source"
        />
        {task?.location && (
          <MapPinSimple
            className="fc-delta-icon"
            aria-label="location"
            weight="regular"
          />
        )}
        {task?.meetingUrl && (
          <VideoCamera
            className="fc-delta-icon"
            aria-label="meeting"
            weight="regular"
          />
        )}
      </div>
      {arg.timeText && (
        <div className="fc-delta-event-time">{arg.timeText}</div>
      )}
    </div>
  );
}
