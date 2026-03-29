import { describe, expect, it } from "vitest";
import { parseICalendar } from "@/core/ical/parser";

const SIMPLE_EVENT = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test-uid-1@example.com
DTSTART:20260401T090000Z
DTEND:20260401T100000Z
SUMMARY:Team standup
DTSTAMP:20260328T000000Z
END:VEVENT
END:VCALENDAR`;

const ALL_DAY_EVENT = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test-uid-allday@example.com
DTSTART;VALUE=DATE:20260401
DTEND;VALUE=DATE:20260402
SUMMARY:Company holiday
DTSTAMP:20260328T000000Z
END:VEVENT
END:VCALENDAR`;

const RECURRING_EVENT = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test-uid-recurring@example.com
DTSTART:20260401T090000Z
DTEND:20260401T100000Z
SUMMARY:Weekly sync
RRULE:FREQ=WEEKLY;BYDAY=WE
DTSTAMP:20260328T000000Z
END:VEVENT
END:VCALENDAR`;

const RICH_EVENT = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:test-uid-rich@example.com
DTSTART:20260401T140000Z
DTEND:20260401T150000Z
SUMMARY:Offsite planning
DESCRIPTION:Discuss Q3 goals
LOCATION:Conference Room B
URL:https://meet.example.com/planning
STATUS:CONFIRMED
DTSTAMP:20260328T000000Z
END:VEVENT
END:VCALENDAR`;

describe("parseICalendar", () => {
  it("parses a simple VCALENDAR with one event", async () => {
    const events = await parseICalendar(SIMPLE_EVENT);
    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe("test-uid-1@example.com");
    expect(events[0].summary).toBe("Team standup");
    expect(events[0].dtstart).toEqual(new Date("2026-04-01T09:00:00.000Z"));
    expect(events[0].dtend).toEqual(new Date("2026-04-01T10:00:00.000Z"));
    expect(events[0].allDay).toBe(false);
  });

  it("parses an all-day event", async () => {
    const events = await parseICalendar(ALL_DAY_EVENT);
    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe("test-uid-allday@example.com");
    expect(events[0].summary).toBe("Company holiday");
    expect(events[0].allDay).toBe(true);
  });

  it("parses a recurring event with RRULE", async () => {
    const events = await parseICalendar(RECURRING_EVENT);
    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe("test-uid-recurring@example.com");
    expect(events[0].rrule).toBeDefined();
    expect(events[0].rrule).toContain("FREQ=WEEKLY");
  });

  it("parses event with location, URL, description, and status", async () => {
    const events = await parseICalendar(RICH_EVENT);
    expect(events).toHaveLength(1);
    expect(events[0].location).toBe("Conference Room B");
    expect(events[0].url).toBe("https://meet.example.com/planning");
    expect(events[0].description).toBe("Discuss Q3 goals");
    expect(events[0].status).toBe("CONFIRMED");
  });

  it("returns empty array for empty input", async () => {
    const events = await parseICalendar("");
    expect(events).toHaveLength(0);
  });

  it("returns empty array for malformed input", async () => {
    const events = await parseICalendar("not valid ical data");
    expect(events).toHaveLength(0);
  });

  it("skips non-VEVENT components", async () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VTODO
UID:todo-1@example.com
SUMMARY:A todo item
DTSTAMP:20260328T000000Z
END:VTODO
BEGIN:VEVENT
UID:event-1@example.com
DTSTART:20260401T090000Z
SUMMARY:Real event
DTSTAMP:20260328T000000Z
END:VEVENT
END:VCALENDAR`;
    const events = await parseICalendar(ics);
    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe("event-1@example.com");
  });

  it("parses multiple events", async () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Test//EN
BEGIN:VEVENT
UID:multi-1@example.com
DTSTART:20260401T090000Z
SUMMARY:First
DTSTAMP:20260328T000000Z
END:VEVENT
BEGIN:VEVENT
UID:multi-2@example.com
DTSTART:20260402T090000Z
SUMMARY:Second
DTSTAMP:20260328T000000Z
END:VEVENT
END:VCALENDAR`;
    const events = await parseICalendar(ics);
    expect(events).toHaveLength(2);
  });
});
