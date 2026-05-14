import { describe, expect, it } from "vitest";
import { EXTERNAL_LINK_PROVIDER } from "@/core/external-link-providers";
import { mapGoogleCalendarEvents } from "@/core/google/calendar-mapper";
import type {
  GoogleCalendarEvent,
  GoogleCalendarSourceSummary,
} from "@/core/google/types";

const source: GoogleCalendarSourceSummary = {
  id: 12,
  sourceId: "work@example.com",
  title: "Work Calendar",
  enabled: true,
  hidden: false,
  accessRole: "reader",
  timeZone: "America/New_York",
  defaultCategory: "Work",
  backgroundColor: "#2952a3",
  foregroundColor: "#ffffff",
};

function mapped(event: GoogleCalendarEvent) {
  return mapGoogleCalendarEvents(source, [event]).events[0];
}

describe("Google Calendar event mapper", () => {
  it("maps timed events with timezone, Meet links, formatted notes, and rich metadata", () => {
    const event = mapped({
      id: "event-1",
      etag: '"etag-1"',
      status: "confirmed",
      summary: "Planning",
      description:
        '<p>Discuss <strong>roadmap</strong><br><a href="https://example.com/doc">doc</a></p>',
      location: "Conference room",
      start: {
        dateTime: "2026-05-14T09:30:00-04:00",
        timeZone: "America/New_York",
      },
      end: {
        dateTime: "2026-05-14T10:15:00-04:00",
        timeZone: "America/New_York",
      },
      iCalUID: "event-1@google.com",
      sequence: 3,
      updated: "2026-05-13T12:00:00.000Z",
      eventType: "default",
      visibility: "public",
      transparency: "opaque",
      conferenceData: {
        entryPoints: [
          {
            entryPointType: "video",
            uri: "https://meet.google.com/abc-defg-hij",
          },
        ],
      },
      attendees: [{ email: "friend@example.com", responseStatus: "accepted" }],
      attachments: [{ fileUrl: "https://drive.example/file", title: "Deck" }],
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 10 }],
      },
      organizer: { email: "organizer@example.com" },
      creator: { email: "creator@example.com" },
      source: { title: "source", url: "https://example.com/source" },
    });

    expect(event).toMatchObject({
      provider: EXTERNAL_LINK_PROVIDER.googleCalendar,
      externalId: "work@example.com:event-1",
      iCalUID: "event-1@google.com",
      input: {
        description: "Planning",
        category: "Work",
        startAt: "2026-05-14T13:30:00.000Z",
        endAt: "2026-05-14T14:15:00.000Z",
        allDay: 0,
        timezone: "America/New_York",
        location: "Conference room",
        meetingUrl: "https://meet.google.com/abc-defg-hij",
      },
    });
    const notes = JSON.parse(event.input.notes ?? "{}");
    const inlineNodes = notes.content.flatMap(
      (paragraph: { content?: unknown[] }) => paragraph.content ?? [],
    );
    expect(inlineNodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: "Discuss " }),
        expect.objectContaining({
          text: "roadmap",
          marks: [expect.objectContaining({ type: "bold" })],
        }),
        expect.objectContaining({
          text: "doc",
          marks: [
            expect.objectContaining({
              type: "link",
              attrs: { href: "https://example.com/doc" },
            }),
          ],
        }),
      ]),
    );
    expect(event.metadata).toMatchObject({
      calendarId: "work@example.com",
      eventId: "event-1",
      etag: '"etag-1"',
      sequence: 3,
      eventType: "default",
      status: "confirmed",
      visibility: "public",
      transparency: "opaque",
      descriptionRaw: expect.stringContaining("roadmap"),
      sourceCalendar: {
        title: "Work Calendar",
        accessRole: "reader",
        backgroundColor: "#2952a3",
      },
      conferenceData: {
        entryPoints: [
          {
            entryPointType: "video",
            uri: "https://meet.google.com/abc-defg-hij",
          },
        ],
      },
      attendees: [{ email: "friend@example.com", responseStatus: "accepted" }],
      attachments: [{ fileUrl: "https://drive.example/file", title: "Deck" }],
      organizer: { email: "organizer@example.com" },
      creator: { email: "creator@example.com" },
      raw: expect.objectContaining({ id: "event-1" }),
    });
  });

  it("preserves all-day exclusive end dates for one-day and multi-day events", () => {
    const result = mapGoogleCalendarEvents(source, [
      {
        id: "one-day",
        summary: "Holiday",
        start: { date: "2026-05-14" },
        end: { date: "2026-05-15" },
      },
      {
        id: "multi-day",
        summary: "Conference",
        start: { date: "2026-05-14" },
        end: { date: "2026-05-17" },
      },
    ]);

    expect(result.events[0].input).toMatchObject({
      startAt: "2026-05-14",
      endAt: "2026-05-15",
      allDay: 1,
    });
    expect(result.events[1].input).toMatchObject({
      startAt: "2026-05-14",
      endAt: "2026-05-17",
      allDay: 1,
    });
  });

  it("imports non-default event types and transparent events without filtering", () => {
    const event = mapped({
      id: "focus-time",
      summary: "Focus",
      start: { dateTime: "2026-05-14T15:00:00Z" },
      end: { dateTime: "2026-05-14T16:00:00Z" },
      eventType: "focusTime",
      transparency: "transparent",
    });

    expect(event.input.description).toBe("Focus");
    expect(event.metadata).toMatchObject({
      eventType: "focusTime",
      transparency: "transparent",
    });
  });

  it("maps hidden-detail private events as private placeholders", () => {
    const event = mapped({
      id: "private-1",
      visibility: "private",
      summary: "Busy",
      start: { dateTime: "2026-05-14T15:00:00Z" },
      end: { dateTime: "2026-05-14T16:00:00Z" },
    });

    expect(event.input).toMatchObject({
      description: "private event",
    });
    expect(event.input.notes).toBeUndefined();
    expect(event.metadata).toMatchObject({
      visibility: "private",
      privacy: "[private]",
    });
  });

  it("maps recurring masters, exceptions, and cancelled instances into Delta recurrence fields", () => {
    const result = mapGoogleCalendarEvents(source, [
      {
        id: "series-1",
        summary: "Weekly sync",
        start: {
          dateTime: "2026-05-07T09:00:00-04:00",
          timeZone: "America/New_York",
        },
        end: {
          dateTime: "2026-05-07T09:30:00-04:00",
          timeZone: "America/New_York",
        },
        recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=TH", "EXDATE:20260521T130000Z"],
      },
      {
        id: "series-1_20260514",
        summary: "Weekly sync moved",
        recurringEventId: "series-1",
        originalStartTime: { dateTime: "2026-05-14T09:00:00-04:00" },
        start: { dateTime: "2026-05-14T10:00:00-04:00" },
        end: { dateTime: "2026-05-14T10:30:00-04:00" },
      },
      {
        id: "series-1_20260528",
        status: "cancelled",
        recurringEventId: "series-1",
        originalStartTime: { dateTime: "2026-05-28T09:00:00-04:00" },
        start: { dateTime: "2026-05-28T09:00:00-04:00" },
        end: { dateTime: "2026-05-28T09:30:00-04:00" },
      },
    ]);

    const master = result.events.find((event) => event.eventId === "series-1");
    const exception = result.events.find((event) =>
      event.eventId.includes("20260514"),
    );

    expect(result.cancelledInstances).toBe(1);
    expect(result.cancelledEvents).toMatchObject([
      {
        externalId: "work@example.com:series-1_20260528",
        recurringMasterExternalId: "work@example.com:series-1",
        originalStartAt: "2026-05-28T13:00:00.000Z",
      },
    ]);
    expect(result.events).toHaveLength(2);
    expect(master?.input).toMatchObject({
      recurrence: "FREQ=WEEKLY;BYDAY=TH",
      recurMode: "scheduled",
    });
    expect(JSON.parse(master?.input.exdates ?? "[]")).toEqual([
      "2026-05-21T13:00:00.000Z",
      "2026-05-14T13:00:00.000Z",
      "2026-05-28T13:00:00.000Z",
    ]);
    expect(exception).toMatchObject({
      recurringMasterExternalId: "work@example.com:series-1",
      originalStartAt: "2026-05-14T13:00:00.000Z",
      input: {
        originalStartAt: "2026-05-14T13:00:00.000Z",
        startAt: "2026-05-14T14:00:00.000Z",
      },
    });
  });

  it("reports likely existing iCal duplicates by iCalUID", () => {
    const result = mapGoogleCalendarEvents(
      source,
      [
        {
          id: "dupe",
          iCalUID: "same-event@example.com",
          summary: "Already imported",
          start: { dateTime: "2026-05-14T15:00:00Z" },
          end: { dateTime: "2026-05-14T16:00:00Z" },
        },
      ],
      { existingICalUIDs: new Set(["same-event@example.com"]) },
    );

    expect(result).toMatchObject({
      duplicateSkipped: 1,
      events: [],
      errors: [],
    });
  });
});
