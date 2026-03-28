"use client";

import { useMemo } from "react";
import type { Task } from "@/core/types";
import {
  dayBlendStyle,
  daysInMonth,
  formatDateKey,
  formatTime,
  isSameDay,
  statusColor,
  statusDot,
  weekOffset,
} from "@/lib/calendar-utils";

export function MonthGrid({
  monthStart,
  today,
  tasksByDate,
  onDayClick,
  onTaskClick,
  dayNames,
  categoryColors,
}: {
  monthStart: Date;
  today: Date;
  tasksByDate: Map<string, Task[]>;
  onDayClick: (date: Date, anchorEl: HTMLElement) => void;
  onTaskClick: (task: Task) => void;
  dayNames: string[];
  categoryColors: Record<string, string>;
}) {
  const totalDays = daysInMonth(monthStart);
  const offset = weekOffset(monthStart);

  const cells = useMemo(() => {
    const result: { key: string; day: number | null }[] = [];
    for (let i = 0; i < offset; i++)
      result.push({ key: `pre-${i}`, day: null });
    for (let d = 1; d <= totalDays; d++) result.push({ key: `d-${d}`, day: d });
    while (result.length % 7 !== 0)
      result.push({ key: `post-${result.length}`, day: null });
    return result;
  }, [offset, totalDays]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border/60 shrink-0">
        {dayNames.map((d) => (
          <div
            key={d}
            className="text-xs font-medium text-muted-foreground text-center py-2 border-r border-border/30 last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1 auto-rows-fr overflow-auto">
        {cells.map((cell) => {
          if (cell.day === null) {
            return (
              <div
                key={cell.key}
                className="border-b border-r border-border/30 bg-muted/10"
              />
            );
          }

          const day = cell.day;
          const cellDate = new Date(
            monthStart.getFullYear(),
            monthStart.getMonth(),
            day,
          );
          const dateKey = formatDateKey(cellDate);
          const dayTasks = (tasksByDate.get(dateKey) ?? [])
            .slice()
            .sort((a, b) => (b.allDay ?? 0) - (a.allDay ?? 0));
          const isToday = isSameDay(cellDate, today);
          const isPast = cellDate < today && !isToday;
          const blend = dayBlendStyle(dayTasks, categoryColors);

          return (
            <div
              key={cell.key}
              className={`flex flex-col p-1.5 text-left transition-colors border-b border-r border-border/30 hover:bg-accent/50 ${isToday ? "outline outline-1 -outline-offset-1 outline-primary/50" : ""} ${isPast ? "opacity-50" : ""}`}
              style={!isToday ? blend : undefined}
            >
              <span
                className={`text-xs font-medium mb-1 ${
                  isToday ? "text-primary font-bold" : "text-muted-foreground"
                }`}
              >
                {day}
              </span>
              <div className="flex flex-col gap-0.5 overflow-hidden w-full">
                {dayTasks.slice(0, 3).map((task) => {
                  const timePrefix =
                    task.startAt && !task.allDay
                      ? `(${formatTime(new Date(task.startAt))}) `
                      : "";
                  return (
                    <button
                      type="button"
                      key={task.id}
                      className={`flex items-start gap-1 text-[10px] leading-tight max-w-full px-1 py-0.5 transition-colors hover:bg-accent w-full text-left ${statusColor(task)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTaskClick(task);
                      }}
                    >
                      <span
                        className={`shrink-0 mt-[3px] w-1.5 h-1.5 ${statusDot(task)}`}
                      />
                      <span className="truncate">
                        {timePrefix}
                        {task.description}
                      </span>
                    </button>
                  );
                })}
                {dayTasks.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1">
                    +{dayTasks.length - 3}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="flex-1 min-h-[1rem] w-full cursor-pointer"
                onClick={(e) => onDayClick(cellDate, e.currentTarget)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
