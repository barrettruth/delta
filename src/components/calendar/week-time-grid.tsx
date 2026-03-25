"use client";

import { useEffect, useMemo, useRef } from "react";
import { EventBlock } from "@/components/calendar/event-block";
import type { Task } from "@/core/types";
import {
  addDays,
  DAY_NAMES,
  formatDateKey,
  formatMilitaryTime,
  getMinutesFromMidnight,
  HOUR_HEIGHT,
  isSameDay,
} from "@/lib/calendar-utils";

interface ColumnLayout {
  task: Task;
  column: number;
  totalColumns: number;
}

function computeOverlapLayout(tasks: Task[]): ColumnLayout[] {
  if (tasks.length === 0) return [];

  const sorted = [...tasks].sort((a, b) => {
    const aStart = a.startAt ? new Date(a.startAt).getTime() : 0;
    const bStart = b.startAt ? new Date(b.startAt).getTime() : 0;
    return aStart - bStart;
  });

  const columns: { end: number; task: Task }[][] = [];

  for (const task of sorted) {
    const start = task.startAt
      ? getMinutesFromMidnight(new Date(task.startAt))
      : 0;
    const end = task.endAt
      ? getMinutesFromMidnight(new Date(task.endAt))
      : start + 15;

    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      const lastInCol = columns[c][columns[c].length - 1];
      if (lastInCol.end <= start) {
        columns[c].push({ end, task });
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([{ end, task }]);
    }
  }

  const totalColumns = columns.length;
  const result: ColumnLayout[] = [];
  for (let c = 0; c < columns.length; c++) {
    for (const entry of columns[c]) {
      result.push({ task: entry.task, column: c, totalColumns });
    }
  }
  return result;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function WeekTimeGrid({
  weekStart,
  today,
  timedTasksByDate,
  onSlotClick,
  onTaskClick,
  categoryColors,
  selectedDate,
  scrollRef: externalScrollRef,
}: {
  weekStart: Date;
  today: Date;
  timedTasksByDate: Map<string, Task[]>;
  onSlotClick: (date: Date, minuteOfDay: number, anchorEl: HTMLElement) => void;
  onTaskClick: (task: Task) => void;
  categoryColors: Record<string, string>;
  selectedDate: Date | null;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const internalRef = useRef<HTMLDivElement>(null);
  const scrollRef = externalScrollRef || internalRef;
  const totalHeight = 24 * HOUR_HEIGHT;

  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < 7; i++) {
      result.push(addDays(weekStart, i));
    }
    return result;
  }, [weekStart]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const now = new Date();
    const scrollTo = Math.max(0, (now.getHours() - 1) * HOUR_HEIGHT);
    scrollRef.current.scrollTop = scrollTo;
  }, [scrollRef.current]);

  const nowMinutes = useMemo(() => {
    const now = new Date();
    return getMinutesFromMidnight(now);
  }, []);

  const todayKey = formatDateKey(today);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div
        className="grid shrink-0 border-b border-border/60"
        style={{ gridTemplateColumns: "4rem repeat(7, 1fr)" }}
      >
        <div className="py-2" />
        {days.map((date, idx) => {
          const isToday = isSameDay(date, today);
          const isSelected =
            selectedDate !== null && isSameDay(date, selectedDate);
          return (
            <div
              key={formatDateKey(date)}
              className={`flex flex-col items-center py-2 border-l border-border/30 ${isSelected ? "bg-accent" : isToday ? "bg-primary/10" : ""}`}
            >
              <span className="text-xs text-muted-foreground">
                {DAY_NAMES[idx]}
              </span>
              <span
                className={`text-sm font-semibold mt-0.5 ${isToday ? "text-primary" : "text-foreground"}`}
              >
                {date.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto relative">
        <div
          className="grid"
          style={{
            gridTemplateColumns: "4rem repeat(7, 1fr)",
            height: `${totalHeight}px`,
          }}
        >
          <div className="relative">
            {HOURS.map((h) => (
              <div
                key={`gutter-${h}`}
                className="absolute right-2 text-[10px] text-muted-foreground tabular-nums"
                style={{ top: `${h * HOUR_HEIGHT - 6}px` }}
              >
                {h > 0 ? formatMilitaryTime(h) : ""}
              </div>
            ))}
          </div>

          {days.map((date) => {
            const key = formatDateKey(date);
            const tasks = timedTasksByDate.get(key) ?? [];
            const layout = computeOverlapLayout(tasks);
            const isToday = key === todayKey;

            return (
              <div
                key={key}
                className="relative border-l border-border/30 cursor-pointer"
                style={{ height: `${totalHeight}px` }}
                role="button"
                tabIndex={0}
                onKeyDown={() => {}}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y =
                    e.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0);
                  const minutes = Math.floor((y / HOUR_HEIGHT) * 60);
                  const snapped = Math.round(minutes / 15) * 15;
                  onSlotClick(date, snapped, e.currentTarget);
                }}
              >
                {HOURS.map((h) => (
                  <div
                    key={`line-${h}`}
                    className="absolute left-0 right-0 border-t border-border/20"
                    style={{ top: `${h * HOUR_HEIGHT}px` }}
                  />
                ))}

                {isToday && (
                  <div
                    className="absolute left-0 right-0 border-t-2 border-primary z-10 pointer-events-none"
                    style={{ top: `${(nowMinutes / 60) * HOUR_HEIGHT}px` }}
                  />
                )}

                {layout.map(({ task, column, totalColumns }) => (
                  <EventBlock
                    key={task.id}
                    task={task}
                    column={column}
                    totalColumns={totalColumns}
                    categoryColor={
                      task.category ? categoryColors[task.category] : undefined
                    }
                    onClick={(t) => {
                      onTaskClick(t);
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
