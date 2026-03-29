import { describe, expect, it } from "vitest";
import type { GoogleEvent } from "@/core/google-calendar";
import {
  extractPlainText,
  googleEventToTaskInput,
  taskToGoogleEvent,
} from "@/core/google-calendar-mapper";
import type { Task } from "@/core/types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    userId: 1,
    description: "Test task",
    status: "pending",
    category: "Todo",
    due: null,
    recurrence: null,
    recurMode: null,
    notes: null,
    order: 0,
    createdAt: "2026-03-29T00:00:00.000Z",
    updatedAt: "2026-03-29T00:00:00.000Z",
    startAt: "2026-03-29T10:00:00-05:00",
    endAt: "2026-03-29T11:00:00-05:00",
    allDay: 0,
    timezone: "America/Chicago",
    completedAt: null,
    location: null,
    meetingUrl: null,
    exdates: null,
    rdates: null,
    recurringTaskId: null,
    originalStartAt: null,
    externalId: null,
    externalSource: null,
    ...overrides,
  };
}

describe("extractPlainText", () => {
  it("returns empty string for null", () => {
    expect(extractPlainText(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(extractPlainText(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(extractPlainText("")).toBe("");
  });

  it("returns raw string for non-JSON input", () => {
    expect(extractPlainText("plain text notes")).toBe("plain text notes");
  });

  it("returns raw string for JSON that is not a ProseMirror doc", () => {
    expect(extractPlainText(JSON.stringify({ key: "value" }))).toBe(
      JSON.stringify({ key: "value" }),
    );
  });

  it("returns raw string for JSON array", () => {
    expect(extractPlainText(JSON.stringify([1, 2, 3]))).toBe(
      JSON.stringify([1, 2, 3]),
    );
  });

  it("extracts text from ProseMirror doc", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };
    expect(extractPlainText(JSON.stringify(doc))).toBe("Hello world");
  });

  it("joins multiple paragraphs", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "First" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Second" }],
        },
      ],
    };
    expect(extractPlainText(JSON.stringify(doc))).toBe("First\nSecond");
  });

  it("returns empty string for doc with no content", () => {
    expect(extractPlainText(JSON.stringify({ type: "doc" }))).toBe("");
  });
});

describe("googleEventToTaskInput", () => {
  it("maps a timed event", () => {
    const event: GoogleEvent = {
      id: "event123",
      summary: "Team standup",
      description: "Daily sync meeting",
      start: {
        dateTime: "2026-03-29T10:00:00-05:00",
        timeZone: "America/Chicago",
      },
      end: {
        dateTime: "2026-03-29T10:30:00-05:00",
      },
      status: "confirmed",
      updated: "2026-03-29T00:00:00.000Z",
    };

    const result = googleEventToTaskInput(event);

    expect(result.description).toBe("Team standup");
    expect(result.notes).toBe("Daily sync meeting");
    expect(result.startAt).toBe("2026-03-29T10:00:00-05:00");
    expect(result.endAt).toBe("2026-03-29T10:30:00-05:00");
    expect(result.allDay).toBe(0);
    expect(result.timezone).toBe("America/Chicago");
    expect(result.externalId).toBe("gcal:event123");
    expect(result.externalSource).toBe("google_calendar");
    expect(result.status).toBe("pending");
  });

  it("maps an all-day event", () => {
    const event: GoogleEvent = {
      id: "allday1",
      summary: "Vacation",
      start: { date: "2026-04-01" },
      end: { date: "2026-04-03" },
      status: "confirmed",
    };

    const result = googleEventToTaskInput(event);

    expect(result.startAt).toBe("2026-04-01");
    expect(result.endAt).toBe("2026-04-03");
    expect(result.allDay).toBe(1);
    expect(result.timezone).toBeUndefined();
  });

  it("maps a recurring event", () => {
    const event: GoogleEvent = {
      id: "recurring1",
      summary: "Weekly review",
      start: {
        dateTime: "2026-03-29T14:00:00Z",
        timeZone: "UTC",
      },
      end: {
        dateTime: "2026-03-29T15:00:00Z",
      },
      recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=FR"],
      status: "confirmed",
    };

    const result = googleEventToTaskInput(event);

    expect(result.recurrence).toBe("FREQ=WEEKLY;BYDAY=FR");
  });

  it("maps a recurring event without RRULE prefix", () => {
    const event: GoogleEvent = {
      id: "recurring2",
      summary: "Daily check",
      start: { dateTime: "2026-03-29T09:00:00Z" },
      end: { dateTime: "2026-03-29T09:15:00Z" },
      recurrence: ["FREQ=DAILY;COUNT=10"],
    };

    const result = googleEventToTaskInput(event);

    expect(result.recurrence).toBe("FREQ=DAILY;COUNT=10");
  });

  it("maps event with location", () => {
    const event: GoogleEvent = {
      id: "loc1",
      summary: "Lunch",
      start: { dateTime: "2026-03-29T12:00:00Z" },
      end: { dateTime: "2026-03-29T13:00:00Z" },
      location: "123 Main St",
    };

    const result = googleEventToTaskInput(event);
    expect(result.location).toBe("123 Main St");
  });

  it("maps event with conference data", () => {
    const event: GoogleEvent = {
      id: "conf1",
      summary: "Video call",
      start: { dateTime: "2026-03-29T14:00:00Z" },
      end: { dateTime: "2026-03-29T15:00:00Z" },
      conferenceData: {
        entryPoints: [
          { uri: "https://meet.google.com/abc-def", entryPointType: "video" },
          { uri: "tel:+1234567890", entryPointType: "phone" },
        ],
      },
    };

    const result = googleEventToTaskInput(event);
    expect(result.meetingUrl).toBe("https://meet.google.com/abc-def");
  });

  it("picks first uri entry point if no video type", () => {
    const event: GoogleEvent = {
      id: "conf2",
      summary: "Phone call",
      start: { dateTime: "2026-03-29T14:00:00Z" },
      end: { dateTime: "2026-03-29T15:00:00Z" },
      conferenceData: {
        entryPoints: [{ uri: "tel:+1234567890", entryPointType: "phone" }],
      },
    };

    const result = googleEventToTaskInput(event);
    expect(result.meetingUrl).toBe("tel:+1234567890");
  });

  it("maps cancelled status", () => {
    const event: GoogleEvent = {
      id: "cancel1",
      summary: "Cancelled meeting",
      status: "cancelled",
    };

    const result = googleEventToTaskInput(event);
    expect(result.status).toBe("cancelled");
  });

  it("maps tentative status to pending", () => {
    const event: GoogleEvent = {
      id: "tent1",
      summary: "Maybe meeting",
      status: "tentative",
    };

    const result = googleEventToTaskInput(event);
    expect(result.status).toBe("pending");
  });

  it("uses (No title) for events without summary", () => {
    const event: GoogleEvent = {
      id: "notitle1",
      start: { dateTime: "2026-03-29T10:00:00Z" },
      end: { dateTime: "2026-03-29T11:00:00Z" },
    };

    const result = googleEventToTaskInput(event);
    expect(result.description).toBe("(No title)");
  });

  it("skips EXDATE/RDATE lines in recurrence", () => {
    const event: GoogleEvent = {
      id: "complex1",
      summary: "Complex recurring",
      start: { dateTime: "2026-03-29T10:00:00Z" },
      end: { dateTime: "2026-03-29T11:00:00Z" },
      recurrence: [
        "EXDATE;VALUE=DATE:20260405",
        "RRULE:FREQ=DAILY",
        "RDATE;VALUE=DATE:20260410",
      ],
    };

    const result = googleEventToTaskInput(event);
    expect(result.recurrence).toBe("FREQ=DAILY");
  });
});

describe("taskToGoogleEvent", () => {
  it("maps a timed task", () => {
    const task = makeTask();
    const event = taskToGoogleEvent(task);

    expect(event.summary).toBe("Test task");
    expect(event.start).toEqual({
      dateTime: "2026-03-29T10:00:00-05:00",
      timeZone: "America/Chicago",
    });
    expect(event.end).toEqual({
      dateTime: "2026-03-29T11:00:00-05:00",
      timeZone: "America/Chicago",
    });
    expect(event.status).toBe("confirmed");
  });

  it("maps an all-day task", () => {
    const task = makeTask({
      startAt: "2026-04-01",
      endAt: "2026-04-03",
      allDay: 1,
      timezone: null,
    });

    const event = taskToGoogleEvent(task);

    expect(event.start).toEqual({ date: "2026-04-01" });
    expect(event.end).toEqual({ date: "2026-04-03" });
  });

  it("maps task with recurrence", () => {
    const task = makeTask({ recurrence: "FREQ=WEEKLY;BYDAY=MO" });
    const event = taskToGoogleEvent(task);
    expect(event.recurrence).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=MO"]);
  });

  it("does not double-prefix RRULE", () => {
    const task = makeTask({ recurrence: "RRULE:FREQ=DAILY" });
    const event = taskToGoogleEvent(task);
    expect(event.recurrence).toEqual(["RRULE:FREQ=DAILY"]);
  });

  it("maps task with location", () => {
    const task = makeTask({ location: "Conference Room B" });
    const event = taskToGoogleEvent(task);
    expect(event.location).toBe("Conference Room B");
  });

  it("maps cancelled task status", () => {
    const task = makeTask({ status: "cancelled" });
    const event = taskToGoogleEvent(task);
    expect(event.status).toBe("cancelled");
  });

  it("maps done task to confirmed", () => {
    const task = makeTask({ status: "done" });
    const event = taskToGoogleEvent(task);
    expect(event.status).toBe("confirmed");
  });

  it("maps wip task to confirmed", () => {
    const task = makeTask({ status: "wip" });
    const event = taskToGoogleEvent(task);
    expect(event.status).toBe("confirmed");
  });

  it("extracts plain text from ProseMirror notes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Meeting notes here" }],
        },
      ],
    };
    const task = makeTask({ notes: JSON.stringify(doc) });
    const event = taskToGoogleEvent(task);
    expect(event.description).toBe("Meeting notes here");
  });

  it("passes through plain string notes", () => {
    const task = makeTask({ notes: "simple notes" });
    const event = taskToGoogleEvent(task);
    expect(event.description).toBe("simple notes");
  });

  it("omits description for null notes", () => {
    const task = makeTask({ notes: null });
    const event = taskToGoogleEvent(task);
    expect(event.description).toBeUndefined();
  });

  it("omits location when null", () => {
    const task = makeTask({ location: null });
    const event = taskToGoogleEvent(task);
    expect(event.location).toBeUndefined();
  });

  it("omits recurrence when null", () => {
    const task = makeTask({ recurrence: null });
    const event = taskToGoogleEvent(task);
    expect(event.recurrence).toBeUndefined();
  });
});

describe("round-trip mapping", () => {
  it("timed event round-trips through google -> delta -> google", () => {
    const originalEvent: GoogleEvent = {
      id: "rt1",
      summary: "Round trip meeting",
      description: "Test round trip",
      start: {
        dateTime: "2026-03-29T10:00:00-05:00",
        timeZone: "America/Chicago",
      },
      end: {
        dateTime: "2026-03-29T11:00:00-05:00",
        timeZone: "America/Chicago",
      },
      location: "Office",
      status: "confirmed",
    };

    const taskInput = googleEventToTaskInput(originalEvent);
    const task = makeTask({
      description: taskInput.description,
      notes: taskInput.notes,
      startAt: taskInput.startAt,
      endAt: taskInput.endAt,
      allDay: taskInput.allDay,
      timezone: taskInput.timezone,
      location: taskInput.location,
      status: taskInput.status,
    });

    const resultEvent = taskToGoogleEvent(task);

    expect(resultEvent.summary).toBe(originalEvent.summary);
    expect(resultEvent.description).toBe(originalEvent.description);
    expect(resultEvent.location).toBe(originalEvent.location);
    expect(resultEvent.status).toBe("confirmed");
    expect((resultEvent.start as Record<string, string>).dateTime).toBe(
      originalEvent.start?.dateTime,
    );
    expect((resultEvent.start as Record<string, string>).timeZone).toBe(
      originalEvent.start?.timeZone,
    );
  });

  it("all-day event round-trips", () => {
    const originalEvent: GoogleEvent = {
      id: "rt2",
      summary: "All day trip",
      start: { date: "2026-04-01" },
      end: { date: "2026-04-02" },
      status: "confirmed",
    };

    const taskInput = googleEventToTaskInput(originalEvent);
    const task = makeTask({
      description: taskInput.description,
      startAt: taskInput.startAt,
      endAt: taskInput.endAt,
      allDay: taskInput.allDay,
      timezone: null,
    });

    const resultEvent = taskToGoogleEvent(task);

    expect((resultEvent.start as Record<string, string>).date).toBe(
      "2026-04-01",
    );
    expect((resultEvent.end as Record<string, string>).date).toBe("2026-04-02");
  });

  it("recurring event round-trips", () => {
    const originalEvent: GoogleEvent = {
      id: "rt3",
      summary: "Recurring",
      start: { dateTime: "2026-03-29T09:00:00Z" },
      end: { dateTime: "2026-03-29T10:00:00Z" },
      recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"],
    };

    const taskInput = googleEventToTaskInput(originalEvent);
    const task = makeTask({
      description: taskInput.description,
      startAt: taskInput.startAt,
      endAt: taskInput.endAt,
      allDay: taskInput.allDay ?? 0,
      recurrence: taskInput.recurrence,
    });

    const resultEvent = taskToGoogleEvent(task);

    expect(resultEvent.recurrence).toEqual([
      "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR",
    ]);
  });
});
