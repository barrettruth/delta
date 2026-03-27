"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventBlock } from "@/components/calendar/event-block";
import type { Task } from "@/core/types";
import { useTimeGridInteraction } from "@/hooks/use-time-grid-interaction";
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
  onEventMove,
  onEventResize,
  onRangeCreate,
}: {
  weekStart: Date;
  today: Date;
  timedTasksByDate: Map<string, Task[]>;
  onSlotClick: (
    date: Date,
    minuteOfDay: number,
    anchor: Element | { getBoundingClientRect: () => DOMRect },
  ) => void;
  onTaskClick: (task: Task) => void;
  categoryColors: Record<string, string>;
  selectedDate: Date | null;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onEventMove?: (taskId: number, newStartAt: string, newEndAt: string | null) => void;
  onEventResize?: (taskId: number, newEndAt: string) => void;
  onRangeCreate?: (dayIndex: number, startMinute: number, endMinute: number, anchor: DOMRect) => void;
}) {
  const internalRef = useRef<HTMLDivElement>(null);
  const scrollRef = externalScrollRef || internalRef;
  const cursorRef = useRef<HTMLDivElement>(null);
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
  }, []);

  const selectedDayIndex = useMemo(() => {
    if (!selectedDate) return -1;
    return days.findIndex((d) => isSameDay(d, selectedDate));
  }, [selectedDate, days]);

  const selectedHour = useMemo(() => {
    if (!selectedDate || selectedDayIndex < 0) return -1;
    return selectedDate.getHours();
  }, [selectedDate, selectedDayIndex]);

  const scrollCursorIntoView = useCallback(() => {
    if (!cursorRef.current || !scrollRef.current) return;
    const container = scrollRef.current;
    const cursorTop = selectedHour * HOUR_HEIGHT;
    const cursorBottom = cursorTop + HOUR_HEIGHT;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    if (cursorTop < viewTop) {
      container.scrollTop = cursorTop;
    } else if (cursorBottom > viewBottom) {
      container.scrollTop = cursorBottom - container.clientHeight;
    }
  }, [selectedHour]);

  useEffect(() => {
    scrollCursorIntoView();
  }, [scrollCursorIntoView]);

  const [nowMinutes, setNowMinutes] = useState(() =>
    getMinutesFromMidnight(new Date()),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setNowMinutes(getMinutesFromMidnight(new Date()));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const todayKey = formatDateKey(today);

  const layoutsByDate = useMemo(() => {
    const map = new Map<string, ColumnLayout[]>();
    for (const day of days) {
      const key = formatDateKey(day);
      const tasks = timedTasksByDate.get(key) ?? [];
      map.set(key, computeOverlapLayout(tasks));
    }
    return map;
  }, [timedTasksByDate, days]);

  const tasksRef = useRef(timedTasksByDate);
  tasksRef.current = timedTasksByDate;

  const interaction = useTimeGridInteraction({
    onSlotClick: (dayIndex, minuteOfDay) => {
      const date = days[dayIndex];
      if (!date) return;
      const pxPerMin = HOUR_HEIGHT / 60;
      const columnEls = document.querySelectorAll("[data-day-column]");
      const columnEl = columnEls[dayIndex];
      const rect = columnEl?.getBoundingClientRect();
      const cx = rect ? rect.left + rect.width / 2 : 0;
      const cy = rect ? rect.top + minuteOfDay * pxPerMin - (scrollRef.current?.scrollTop ?? 0) : 0;
      onSlotClick(date, minuteOfDay, {
        getBoundingClientRect: () => new DOMRect(cx, cy, 0, 0),
      });
    },
    onEventClick: (taskId) => {
      for (const [, taskList] of tasksRef.current) {
        const task = taskList.find((t) => t.id === taskId);
        if (task) {
          onTaskClick(task);
          return;
        }
      }
    },
    onEventMove: (taskId, newStartAt, newEndAt) => {
      onEventMove?.(taskId, newStartAt, newEndAt);
    },
    onEventResize: (taskId, newEndAt) => {
      onEventResize?.(taskId, newEndAt);
    },
    onRangeCreate: (dayIndex, startMinute, endMinute, anchor) => {
      onRangeCreate?.(dayIndex, startMinute, endMinute, anchor);
    },
  });

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

      <div ref={scrollRef} data-time-grid-scroll="" className="flex-1 overflow-auto relative">
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

          {days.map((date, dayIdx) => {
            const key = formatDateKey(date);
            const layout = layoutsByDate.get(key) ?? [];
            const isToday = key === todayKey;
            const isCursorDay = dayIdx === selectedDayIndex;

            return (
              <div
                key={key}
                data-day-column={dayIdx}
                className="relative border-l border-border/30 cursor-pointer touch-none"
                style={{ height: `${totalHeight}px` }}
                role="button"
                tabIndex={0}
                onKeyDown={() => {}}
                {...interaction.gridProps}
              >
                {HOURS.map((h) => (
                  <div
                    key={`line-${h}`}
                    className="absolute left-0 right-0 border-t border-border/20 hover:bg-accent/50 transition-colors"
                    style={{
                      top: `${h * HOUR_HEIGHT}px`,
                      height: `${HOUR_HEIGHT}px`,
                    }}
                  />
                ))}

                {HOURS.map((h) =>
                  [1, 2, 3].map((q) => (
                    <div
                      key={`sub-${h}-${q}`}
                      className="absolute left-0 right-0 border-t border-border/10 pointer-events-none"
                      style={{
                        top: `${h * HOUR_HEIGHT + q * (HOUR_HEIGHT / 4)}px`,
                      }}
                    />
                  )),
                )}

                {isCursorDay && selectedHour >= 0 && (
                  <div
                    ref={cursorRef}
                    data-calendar-cursor=""
                    className="absolute left-0 right-0 bg-accent border border-primary/30 pointer-events-none z-[5]"
                    style={{
                      top: `${selectedHour * HOUR_HEIGHT}px`,
                      height: `${HOUR_HEIGHT}px`,
                    }}
                  />
                )}

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
                    isDragging={interaction.draggingTaskId === task.id}
                  />
                ))}

                {interaction.previewStyle && interaction.previewStyle.dayIndex === dayIdx && (
                  <div
                    className="absolute left-1 right-1 border border-dashed border-primary z-20 pointer-events-none"
                    style={{
                      top: `${interaction.previewStyle.top}px`,
                      height: `${interaction.previewStyle.height}px`,
                      backgroundColor: interaction.mode === "creating"
                        ? "hsl(var(--primary) / 0.1)"
                        : "hsl(var(--primary) / 0.4)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
