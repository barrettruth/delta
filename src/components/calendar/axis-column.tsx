"use client";

import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";

/**
 * Fixed time-axis column shown to the left of the swipe pager in day/week
 * views. Renders a minimal FullCalendar instance and CSS-hides everything but
 * the time axis column so the user sees only hour labels (and optionally the
 * all-day row label). Lives OUTSIDE the sliding track so it never moves.
 *
 * Slot heights auto-sync with the pager's FCs because all three live in the
 * same vertical flex container and use `height="100%"` + `expandRows`.
 */
export function AxisColumn({
  allDaySlot,
  referenceDate,
}: {
  allDaySlot: boolean;
  referenceDate: Date;
}) {
  return (
    <div
      className="fc-delta-root fc-axis-only shrink-0"
      style={{ width: "max-content" }}
    >
      <FullCalendar
        plugins={[timeGridPlugin]}
        initialView="timeGridDay"
        initialDate={referenceDate}
        headerToolbar={false}
        /* Keep the column header row so its height matches the panes' header
           row — we CSS-blank the cell content but preserve layout height. */
        dayHeaders
        allDaySlot={allDaySlot}
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        slotEventOverlap={false}
        expandRows
        height="100%"
        events={[]}
        selectable={false}
        editable={false}
        nowIndicator={false}
      />
    </div>
  );
}
