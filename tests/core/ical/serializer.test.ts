import { describe, expect, it } from "vitest";
import type { Task } from "@/core/types";
import { taskToVEvent, tasksToICalendar } from "@/core/ical/serializer";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    userId: 1,
    description: "Test event",
    status: "pending",
    category: "Work",
    label: null,
    due: null,
    recurrence: null,
    recurMode: null,
    notes: null,
    order: 0,
    createdAt: "2026-03-28T10:00:00.000Z",
    updatedAt: "2026-03-28T10:00:00.000Z",
    startAt: "2026-04-01T09:00:00.000Z",
    endAt: "2026-04-01T10:00:00.000Z",
    allDay: 0,
    timezone: null,
    completedAt: null,
    location: null,
    meetingUrl: null,
    exdates: null,
    rdates: null,
    recurringTaskId: null,
    originalStartAt: null,
    ...overrides,
  };
}

describe("taskToVEvent", () => {
  it("returns null for task without startAt", () => {
    const task = makeTask({ startAt: null });
    expect(taskToVEvent(task)).toBeNull();
  });

  it("maps a timed event", () => {
    const task = makeTask();
    const event = taskToVEvent(task)!;
    expect(event.id).toBe("delta-task-1@delta.barrettruth.com");
    expect(event.summary).toBe("Test event");
    expect(event.start).toEqual(new Date("2026-04-01T09:00:00.000Z"));
    expect(event.end).toEqual(new Date("2026-04-01T10:00:00.000Z"));
    expect(event.allDay).toBe(false);
    expect(event.status).toBe("CONFIRMED");
  });

  it("maps an all-day event", () => {
    const task = makeTask({ allDay: 1 });
    const event = taskToVEvent(task)!;
    expect(event.allDay).toBe(true);
  });

  it("includes timezone when set", () => {
    const task = makeTask({ timezone: "America/New_York" });
    const event = taskToVEvent(task)!;
    expect(event.timezone).toBe("America/New_York");
  });

  it("maps description from notes", () => {
    const notes = JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Meeting agenda" }],
        },
      ],
    });
    const task = makeTask({ notes });
    const event = taskToVEvent(task)!;
    expect(event.description).toBe("Meeting agenda");
  });

  it("maps location", () => {
    const task = makeTask({ location: "Conference Room A" });
    const event = taskToVEvent(task)!;
    expect(event.location).toBe("Conference Room A");
  });

  it("maps meetingUrl to url", () => {
    const task = makeTask({ meetingUrl: "https://meet.example.com/abc" });
    const event = taskToVEvent(task)!;
    expect(event.url).toBe("https://meet.example.com/abc");
  });

  it("maps recurrence to repeating", () => {
    const task = makeTask({ recurrence: "FREQ=WEEKLY;BYDAY=MO" });
    const event = taskToVEvent(task)!;
    expect(event.repeating).toBe("FREQ=WEEKLY;BYDAY=MO");
  });

  it("maps exdates as X-EXDATE entries", () => {
    const task = makeTask({
      recurrence: "FREQ=WEEKLY;BYDAY=MO",
      exdates: JSON.stringify(["2026-04-08T09:00:00.000Z"]),
    });
    const event = taskToVEvent(task)!;
    const xEntries = event.x as { key: string; value: string }[];
    expect(xEntries).toBeDefined();
    const exdateEntry = xEntries.find((x) => x.key === "EXDATE");
    expect(exdateEntry).toBeDefined();
    expect(exdateEntry!.value).toBe("20260408T090000Z");
  });

  it("maps rdates as X-RDATE entries", () => {
    const task = makeTask({
      rdates: JSON.stringify(["2026-04-15T09:00:00.000Z"]),
    });
    const event = taskToVEvent(task)!;
    const xEntries = event.x as { key: string; value: string }[];
    expect(xEntries).toBeDefined();
    const rdateEntry = xEntries.find((x) => x.key === "RDATE");
    expect(rdateEntry).toBeDefined();
    expect(rdateEntry!.value).toBe("20260415T090000Z");
  });

  it("maps done status to CANCELLED", () => {
    const task = makeTask({ status: "done" });
    const event = taskToVEvent(task)!;
    expect(event.status).toBe("CANCELLED");
  });

  it("maps cancelled status to CANCELLED", () => {
    const task = makeTask({ status: "cancelled" });
    const event = taskToVEvent(task)!;
    expect(event.status).toBe("CANCELLED");
  });

  it("maps pending status to CONFIRMED", () => {
    const task = makeTask({ status: "pending" });
    const event = taskToVEvent(task)!;
    expect(event.status).toBe("CONFIRMED");
  });

  it("maps wip status to CONFIRMED", () => {
    const task = makeTask({ status: "wip" });
    const event = taskToVEvent(task)!;
    expect(event.status).toBe("CONFIRMED");
  });

  it("maps blocked status to CONFIRMED", () => {
    const task = makeTask({ status: "blocked" });
    const event = taskToVEvent(task)!;
    expect(event.status).toBe("CONFIRMED");
  });
});

describe("tasksToICalendar", () => {
  it("produces valid iCal output", () => {
    const tasks = [makeTask()];
    const output = tasksToICalendar(tasks);
    expect(output).toContain("BEGIN:VCALENDAR");
    expect(output).toContain("END:VCALENDAR");
    expect(output).toContain("BEGIN:VEVENT");
    expect(output).toContain("END:VEVENT");
    expect(output).toContain("PRODID:-//delta//delta v0.1.0//EN");
    expect(output).toContain("SUMMARY:Test event");
  });

  it("uses custom calendar name", () => {
    const output = tasksToICalendar([makeTask()], "My Calendar");
    expect(output).toContain("NAME:My Calendar");
  });

  it("skips tasks without startAt", () => {
    const tasks = [
      makeTask({ id: 1, startAt: null, description: "No date" }),
      makeTask({ id: 2, description: "Has date" }),
    ];
    const output = tasksToICalendar(tasks);
    expect(output).not.toContain("No date");
    expect(output).toContain("Has date");
  });

  it("includes UID in output", () => {
    const output = tasksToICalendar([makeTask()]);
    expect(output).toContain("delta-task-1@delta.barrettruth.com");
  });

  it("produces empty calendar for no events", () => {
    const output = tasksToICalendar([]);
    expect(output).toContain("BEGIN:VCALENDAR");
    expect(output).toContain("END:VCALENDAR");
    expect(output).not.toContain("BEGIN:VEVENT");
  });
});
