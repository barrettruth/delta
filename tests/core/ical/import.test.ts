import { beforeEach, describe, expect, it } from "vitest";
import { importICalEvents } from "@/core/ical/import";
import type { ParsedEvent } from "@/core/ical/parser";
import { listTasks } from "@/core/task";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../../helpers";

let db: Db;
let userId: number;

function makeEvent(overrides: Partial<ParsedEvent> = {}): ParsedEvent {
  return {
    uid: "test-uid@example.com",
    summary: "Test event",
    dtstart: new Date("2026-04-01T09:00:00.000Z"),
    dtend: new Date("2026-04-01T10:00:00.000Z"),
    allDay: false,
    ...overrides,
  };
}

beforeEach(() => {
  db = createTestDb();
  userId = createTestUser(db).id;
});

describe("importICalEvents", () => {
  it("creates tasks from parsed events", () => {
    const events = [
      makeEvent({ uid: "uid-1@example.com", summary: "Meeting" }),
      makeEvent({ uid: "uid-2@example.com", summary: "Lunch" }),
    ];

    const result = importICalEvents(db, userId, events);
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    const tasks = listTasks(db, userId);
    expect(tasks).toHaveLength(2);
  });

  it("maps fields correctly", () => {
    const events = [
      makeEvent({
        uid: "full-event@example.com",
        summary: "Offsite",
        description: "Discuss goals",
        location: "Room A",
        url: "https://meet.example.com/abc",
        rrule: "FREQ=WEEKLY;BYDAY=MO",
        allDay: true,
      }),
    ];

    importICalEvents(db, userId, events);
    const tasks = listTasks(db, userId);
    expect(tasks).toHaveLength(1);

    const task = tasks[0];
    expect(task.description).toBe("Offsite");
    expect(task.startAt).toBe("2026-04-01T09:00:00.000Z");
    expect(task.allDay).toBe(1);
    expect(task.location).toBe("Room A");
    expect(task.meetingUrl).toBe("https://meet.example.com/abc");
    expect(task.recurrence).toBe("FREQ=WEEKLY;BYDAY=MO");
    expect(task.externalId).toBe("full-event@example.com");
    expect(task.externalSource).toBe("ical");

    const notes = JSON.parse(task.notes!);
    expect(notes.type).toBe("doc");
    expect(notes.content[0].content[0].text).toBe("Discuss goals");
  });

  it("skips duplicate events by UID", () => {
    const events = [makeEvent({ uid: "dup@example.com", summary: "First" })];

    const first = importICalEvents(db, userId, events);
    expect(first.created).toBe(1);
    expect(first.skipped).toBe(0);

    const second = importICalEvents(db, userId, events);
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(1);

    const tasks = listTasks(db, userId);
    expect(tasks).toHaveLength(1);
  });

  it("does not skip events from different users with same UID", () => {
    const events = [makeEvent({ uid: "shared@example.com" })];
    const otherUser = createTestUser(db).id;

    importICalEvents(db, userId, events);
    const result = importICalEvents(db, otherUser, events);
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it("uses default category when provided", () => {
    const events = [makeEvent({ uid: "cat@example.com" })];
    importICalEvents(db, userId, events, "Calendar");

    const tasks = listTasks(db, userId);
    expect(tasks[0].category).toBe("Calendar");
  });

  it("uses 'Todo' as default category when none provided", () => {
    const events = [makeEvent({ uid: "nocat@example.com" })];
    importICalEvents(db, userId, events);

    const tasks = listTasks(db, userId);
    expect(tasks[0].category).toBe("Todo");
  });

  it("returns empty result for empty events array", () => {
    const result = importICalEvents(db, userId, []);
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
  });
});
