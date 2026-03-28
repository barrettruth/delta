"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EventBlock } from "@/components/calendar/event-block";
import type { Task } from "@/core/types";
import { useTimeGridInteraction } from "@/hooks/use-time-grid-interaction";
import type { TimedEntry } from "@/lib/calendar-utils";
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
  entry: TimedEntry;
  column: number;
  totalColumns: number;
}

function computeOverlapLayout(entries: TimedEntry[]): ColumnLayout[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => a.timeStartMin - b.timeStartMin);

  const columns: { end: number; entry: TimedEntry }[][] = [];

  for (const entry of sorted) {
    const start = entry.timeStartMin;
    const end = entry.timeEndMin;

    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      const lastInCol = columns[c][columns[c].length - 1];
      if (lastInCol.end <= start) {
        columns[c].push({ end, entry });
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([{ end, entry }]);
    }
  }

  const totalColumns = columns.length;
  const result: ColumnLayout[] = [];
  for (let c = 0; c < columns.length; c++) {
    for (const item of columns[c]) {
      result.push({ entry: item.entry, column: c, totalColumns });
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
  scrollRef: externalScrollRef,
  onEventMove,
  onEventResize,
  onEventResizeStart,
  onRangeCreate,
  createPreview,
}: {
  weekStart: Date;
  today: Date;
  timedTasksByDate: Map<string, TimedEntry[]>;
  onSlotClick: (
    date: Date,
    minuteOfDay: number,
    anchor: Element | { getBoundingClientRect: () => DOMRect },
  ) => void;
  onTaskClick: (task: Task) => void;
  categoryColors: Record<string, string>;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onEventMove?: (
    taskId: number,
    newStartAt: string,
    newEndAt: string | null,
    dayIndex: number,
  ) => void;
  onEventResize?: (taskId: number, newEndAt: string) => void;
  onEventResizeStart?: (taskId: number, newStartAt: string) => void;
  onRangeCreate?: (
    dayIndex: number,
    startMinute: number,
    endMinute: number,
    anchor: DOMRect,
  ) => void;
  createPreview?: { dayIndex: number; startMin: number; endMin: number } | null;
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

  const [nowMinutes, setNowMinutes] = useState(0);

  useEffect(() => {
    setNowMinutes(getMinutesFromMidnight(new Date()));
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
      const entries = timedTasksByDate.get(key) ?? [];
      map.set(key, computeOverlapLayout(entries));
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
      const cy = rect
        ? rect.top +
          minuteOfDay * pxPerMin -
          (scrollRef.current?.scrollTop ?? 0)
        : 0;
      onSlotClick(date, minuteOfDay, {
        getBoundingClientRect: () => new DOMRect(cx, cy, 0, 0),
      });
    },
    onEventClick: (taskId) => {
      for (const [, entries] of tasksRef.current) {
        const entry = entries.find((e) => e.task.id === taskId);
        if (entry) {
          onTaskClick(entry.task);
          return;
        }
      }
    },
    onEventMove: (taskId, newStartAt, newEndAt, dayIndex) => {
      onEventMove?.(taskId, newStartAt, newEndAt, dayIndex);
    },
    onEventResize: (taskId, newEndAt) => {
      onEventResize?.(taskId, newEndAt);
    },
    onEventResizeStart: (taskId, newStartAt) => {
      onEventResizeStart?.(taskId, newStartAt);
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
          return (
            <div
              key={formatDateKey(date)}
              className={`flex flex-col items-center py-2 border-l border-border/30 ${isToday ? "bg-primary/10" : ""}`}
            >
              <span className="text-xs text-muted-foreground">
                {DAY_NAMES[idx]}
              </span>
              <span
                className={`text-sm font-semibold mt-0.5 inline-flex items-center justify-center ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}
                style={isToday ? { width: "24px", height: "24px" } : undefined}
              >
                {date.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        data-time-grid-scroll=""
        className="flex-1 overflow-auto relative"
      >
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
                style={{
                  top: `${h * HOUR_HEIGHT}px`,
                  transform: "translateY(-50%)",
                }}
              >
                {h > 0 ? formatMilitaryTime(h) : ""}
              </div>
            ))}
          </div>

          {days.map((date, dayIdx) => {
            const key = formatDateKey(date);
            const layout = layoutsByDate.get(key) ?? [];
            const isToday = key === todayKey;

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
                      className={`absolute left-0 right-0 border-t pointer-events-none ${q === 2 ? "border-border/20" : "border-border/10"}`}
                      style={{
                        top: `${h * HOUR_HEIGHT + q * (HOUR_HEIGHT / 4)}px`,
                      }}
                    />
                  )),
                )}

                {isToday && (
                  <div
                    className="absolute left-0 right-0 border-t-2 border-primary z-10 pointer-events-none"
                    style={{ top: `${(nowMinutes / 60) * HOUR_HEIGHT}px` }}
                  >
                    <div
                      className="absolute bg-primary"
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        left: "-3px",
                        top: "-4px",
                      }}
                    />
                  </div>
                )}

                {layout.map(({ entry, column, totalColumns }) => (
                  <EventBlock
                    key={`${entry.task.id}-${entry.continuation ?? "full"}`}
                    task={entry.task}
                    column={column}
                    totalColumns={totalColumns}
                    categoryColor={
                      entry.task.category
                        ? categoryColors[entry.task.category]
                        : undefined
                    }
                    onClick={(t) => {
                      onTaskClick(t);
                    }}
                    isDragging={interaction.draggingTaskId === entry.task.id}
                    continuation={entry.continuation}
                    overrideStartMin={entry.timeStartMin}
                    overrideEndMin={entry.timeEndMin}
                    isRecurring={
                      !!entry.task.recurrence || !!entry.task.recurringTaskId
                    }
                  />
                ))}

                {interaction.previewStyle &&
                  interaction.previewStyle.dayIndex === dayIdx && (
                    <div
                      className={`absolute left-0 right-0 border border-primary z-20 pointer-events-none ${interaction.mode === "moving" ? "border-solid" : "border-dashed"}`}
                      style={{
                        top: `${interaction.previewStyle.top}px`,
                        height: `${interaction.previewStyle.height}px`,
                        backgroundColor:
                          interaction.mode === "creating"
                            ? "hsl(var(--primary) / 0.1)"
                            : interaction.mode === "moving"
                              ? "hsl(var(--primary) / 0.2)"
                              : "hsl(var(--primary) / 0.4)",
                      }}
                    />
                  )}

                {createPreview &&
                  createPreview.dayIndex === dayIdx &&
                  !interaction.previewStyle && (
                    <div
                      className="absolute left-0 right-0 border border-dashed border-primary/60 z-10 pointer-events-none"
                      style={{
                        top: `${(createPreview.startMin / 60) * HOUR_HEIGHT}px`,
                        height: `${Math.max(HOUR_HEIGHT / 4, ((createPreview.endMin - createPreview.startMin) / 60) * HOUR_HEIGHT)}px`,
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
