import { beforeEach, describe, expect, it } from "vitest";
import { listExternalLinksForTask } from "@/core/external-links";
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

    const notes = JSON.parse(task.notes as string);
    expect(notes.type).toBe("doc");
    expect(notes.content[0].content[0].text).toBe("Discuss goals");

    const links = listExternalLinksForTask(db, task.id);
    expect(links).toHaveLength(1);
    expect(links[0].provider).toBe("ical");
    expect(links[0].externalId).toBe("full-event@example.com");
  });

  it("stores recurrence metadata on recurring master tasks", () => {
    const events = [
      makeEvent({
        uid: "series@example.com",
        summary: "Seminar",
        timezone: "America/New_York",
        rrule: "FREQ=WEEKLY;BYDAY=MO",
        exdates: [new Date("2026-04-13T13:00:00.000Z")],
        rdates: [new Date("2026-04-15T13:00:00.000Z")],
      }),
    ];

    importICalEvents(db, userId, events);
    const tasks = listTasks(db, userId);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].timezone).toBe("America/New_York");
    expect(tasks[0].recurrence).toBe("FREQ=WEEKLY;BYDAY=MO");
    expect(tasks[0].recurMode).toBe("scheduled");
    expect(tasks[0].exdates).toBe(
      JSON.stringify(["2026-04-13T13:00:00.000Z"]),
    );
    expect(tasks[0].rdates).toBe(
      JSON.stringify(["2026-04-15T13:00:00.000Z"]),
    );
  });

  it("imports recurrence exceptions as exception tasks", () => {
    const events = [
      makeEvent({
        uid: "exceptions@example.com",
        summary: "Lecture",
        rrule: "FREQ=WEEKLY;BYDAY=WE",
      }),
      makeEvent({
        uid: "exceptions@example.com",
        recurrenceId: new Date("2026-04-08T09:00:00.000Z"),
        dtstart: new Date("2026-04-08T11:00:00.000Z"),
        dtend: new Date("2026-04-08T12:00:00.000Z"),
        summary: "Lecture (moved)",
      }),
      makeEvent({
        uid: "exceptions@example.com",
        recurrenceId: new Date("2026-04-15T09:00:00.000Z"),
        status: "CANCELLED",
      }),
    ];

    const result = importICalEvents(db, userId, events);
    expect(result.created).toBe(2);

    const tasks = listTasks(db, userId);
    expect(tasks).toHaveLength(2);

    const master = tasks.find((task) => task.recurringTaskId === null);
    const exception = tasks.find((task) => task.recurringTaskId !== null);

    expect(master?.recurrence).toBe("FREQ=WEEKLY;BYDAY=WE");
    expect(master?.recurMode).toBe("scheduled");
    expect(master?.exdates).toBe(
      JSON.stringify([
        "2026-04-08T09:00:00.000Z",
        "2026-04-15T09:00:00.000Z",
      ]),
    );

    expect(exception?.description).toBe("Lecture (moved)");
    expect(exception?.startAt).toBe("2026-04-08T11:00:00.000Z");
    expect(exception?.originalStartAt).toBe("2026-04-08T09:00:00.000Z");
    expect(exception?.recurringTaskId).toBe(master?.id);

    const exceptionLinks = exception
      ? listExternalLinksForTask(db, exception.id)
      : [];
    expect(exceptionLinks[0]?.externalId).toBe(
      "exceptions@example.com::2026-04-08T09:00:00.000Z",
    );
  });

  it("preserves custom delta status metadata when present", () => {
    const events = [
      makeEvent({
        uid: "status@example.com",
        status: "done",
      }),
    ];

    importICalEvents(db, userId, events);
    const tasks = listTasks(db, userId);
    expect(tasks[0].status).toBe("done");
  });

  it("preserves custom delta status metadata when present", () => {
    const events = [
      makeEvent({
        uid: "status@example.com",
        status: "done",
      }),
    ];

    importICalEvents(db, userId, events);
    const tasks = listTasks(db, userId);
    expect(tasks[0].status).toBe("done");
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

  it("maps URL-like locations to meetingUrl", () => {
    const events = [
      makeEvent({
        uid: "location-url@example.com",
        location: "https://meet.google.com/abc-defg-hij",
      }),
    ];

    importICalEvents(db, userId, events);
    const task = listTasks(db, userId)[0];
    expect(task.meetingUrl).toBe("https://meet.google.com/abc-defg-hij");
    expect(task.location).toBeNull();
  });

  it("extracts Google Meet URLs from descriptions", () => {
    const events = [
      makeEvent({
        uid: "google-desc@example.com",
        description:
          "Join with Google Meet: https://meet.google.com/abc-defg-hij\n\nLearn more about Meet at: https://support.google.com/a/users/answer/9282720",
      }),
    ];

    importICalEvents(db, userId, events);
    const task = listTasks(db, userId)[0];
    expect(task.meetingUrl).toBe("https://meet.google.com/abc-defg-hij");
  });

  it("extracts Zoom URLs from descriptions", () => {
    const events = [
      makeEvent({
        uid: "zoom-desc@example.com",
        description:
          "Join Zoom Meeting\nhttps://us06web.zoom.us/j/6912628470?pwd=abc123\n\nFind your local number: https://us06web.zoom.us/u/kfbD0ah2b",
      }),
    ];

    importICalEvents(db, userId, events);
    const task = listTasks(db, userId)[0];
    expect(task.meetingUrl).toBe(
      "https://us06web.zoom.us/j/6912628470?pwd=abc123",
    );
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
