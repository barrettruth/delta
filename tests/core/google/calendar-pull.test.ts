import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXTERNAL_LINK_PROVIDER } from "@/core/external-link-providers";
import {
  createExternalLink,
  listExternalLinksForTask,
} from "@/core/external-links";
import { pullGoogleCalendar } from "@/core/google/calendar-pull";
import { disconnectGoogleIntegration } from "@/core/google/cleanup";
import { GOOGLE_PROVIDER } from "@/core/google/types";
import { upsertIntegrationConfig } from "@/core/integration-config";
import { createSyncSource, SYNC_SOURCE_KIND } from "@/core/sync-sources";
import { createTask, listTasks } from "@/core/task";
import type { Db } from "@/core/types";
import { syncSources, taskExternalLinks } from "@/db/schema";
import { createTestDb, createTestUser } from "../../helpers";

const TEST_KEY = randomBytes(32).toString("hex");

let db: Db;
let userId: number;

function googleResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function connectGoogle(metadata: Record<string, unknown> = {}) {
  upsertIntegrationConfig(
    db,
    userId,
    GOOGLE_PROVIDER,
    {
      accessToken: "access-token",
      refreshToken: "refresh-token",
    },
    metadata,
  );
}

function createCalendarSource(syncCursor?: string | null) {
  return createSyncSource(db, {
    userId,
    provider: GOOGLE_PROVIDER,
    sourceKind: SYNC_SOURCE_KIND.googleCalendar,
    sourceId: "work@example.com",
    title: "Work",
    defaultCategory: "Work",
    syncCursor,
    readOnly: 1,
    metadata: {
      accessRole: "reader",
      timeZone: "America/New_York",
      backgroundColor: "#2952a3",
    },
  });
}

function fetchCalendarEventsOnce(
  items: Array<Record<string, unknown>>,
  nextSyncToken = "sync-token-1",
) {
  const fetchMock = vi.fn().mockResolvedValueOnce(
    googleResponse({
      items,
      nextSyncToken,
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
  db = createTestDb();
  userId = createTestUser(db, "googlecalendarpull").id;
  connectGoogle({ email: "archive@example.com" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("pullGoogleCalendar", () => {
  it("imports selected Google calendars idempotently and advances sync tokens", async () => {
    const source = createCalendarSource();
    const event = {
      id: "event-1",
      summary: "Planning",
      iCalUID: "event-1@google.com",
      start: { dateTime: "2026-05-14T09:30:00-04:00" },
      end: { dateTime: "2026-05-14T10:15:00-04:00" },
      updated: "2026-05-13T12:00:00.000Z",
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          googleResponse({ items: [event], nextSyncToken: "sync-token-1" }),
        )
        .mockResolvedValueOnce(
          googleResponse({ items: [event], nextSyncToken: "sync-token-2" }),
        ),
    );

    const first = await pullGoogleCalendar(db, userId);
    const second = await pullGoogleCalendar(db, userId);
    const tasks = listTasks(db, userId);
    const link = listExternalLinksForTask(db, tasks[0].id)[0];
    const updatedSource = db
      .select()
      .from(syncSources)
      .where(eq(syncSources.id, source.id))
      .get();

    expect(first).toMatchObject({ seen: 1, created: 1, skipped: 0 });
    expect(second).toMatchObject({ seen: 1, created: 0, skipped: 1 });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      description: "Planning",
      category: "Work",
      startAt: "2026-05-14T13:30:00.000Z",
      endAt: "2026-05-14T14:15:00.000Z",
    });
    expect(link).toMatchObject({
      provider: EXTERNAL_LINK_PROVIDER.googleCalendar,
      externalId: "work@example.com:event-1",
      syncSourceId: source.id,
    });
    expect(JSON.parse(link.metadata ?? "{}")).toMatchObject({
      readOnly: true,
      googleAccountEmail: "archive@example.com",
      eventId: "event-1",
      iCalUID: "event-1@google.com",
    });
    expect(updatedSource?.syncCursor).toBe("sync-token-2");
  });

  it("updates existing imports through the sync path and skips iCal duplicates", async () => {
    createCalendarSource();
    const imported = createTask(db, userId, {
      description: "Old title",
      startAt: "2026-05-14T13:30:00.000Z",
      endAt: "2026-05-14T14:15:00.000Z",
    });
    createExternalLink(db, {
      userId,
      taskId: imported.id,
      provider: EXTERNAL_LINK_PROVIDER.googleCalendar,
      externalId: "work@example.com:event-1",
    });
    const ical = createTask(db, userId, {
      description: "Existing ICS",
      startAt: "2026-05-15T13:30:00.000Z",
    });
    createExternalLink(db, {
      userId,
      taskId: ical.id,
      provider: EXTERNAL_LINK_PROVIDER.ical,
      externalId: "dupe@google.com",
    });
    fetchCalendarEventsOnce([
      {
        id: "event-1",
        summary: "New title",
        start: { dateTime: "2026-05-14T09:30:00-04:00" },
        end: { dateTime: "2026-05-14T10:15:00-04:00" },
      },
      {
        id: "dupe",
        summary: "Duplicate",
        iCalUID: "dupe@google.com",
        start: { dateTime: "2026-05-15T09:30:00-04:00" },
        end: { dateTime: "2026-05-15T10:15:00-04:00" },
      },
    ]);

    const result = await pullGoogleCalendar(db, userId);
    const tasks = listTasks(db, userId);

    expect(result).toMatchObject({
      seen: 2,
      updated: 1,
      duplicateSkipped: 1,
    });
    expect(tasks).toHaveLength(2);
    expect(tasks.find((task) => task.id === imported.id)).toMatchObject({
      description: "New title",
    });
  });

  it("backfills the connected Google account email onto unchanged existing imports", async () => {
    const source = createCalendarSource("sync-token-1");
    const imported = createTask(db, userId, {
      description: "Already imported",
      startAt: "2026-05-14T13:30:00.000Z",
    });
    createExternalLink(db, {
      userId,
      taskId: imported.id,
      syncSourceId: source.id,
      provider: EXTERNAL_LINK_PROVIDER.googleCalendar,
      externalId: "work@example.com:event-1",
      metadata: {
        htmlLink: "https://calendar.google.com/event?eid=event-1",
      },
    });
    fetchCalendarEventsOnce([], "sync-token-2");

    const result = await pullGoogleCalendar(db, userId);
    const link = listExternalLinksForTask(db, imported.id)[0];

    expect(result).toMatchObject({ seen: 0, created: 0, updated: 0 });
    expect(JSON.parse(link.metadata ?? "{}")).toMatchObject({
      htmlLink: "https://calendar.google.com/event?eid=event-1",
      googleAccountEmail: "archive@example.com",
    });
  });

  it("recovers from expired sync tokens with a visible full resync", async () => {
    const source = createCalendarSource("expired-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(googleResponse({ error: "gone" }, 410))
      .mockResolvedValueOnce(
        googleResponse({
          items: [],
          nextSyncToken: "fresh-token",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await pullGoogleCalendar(db, userId);
    const updatedSource = db
      .select()
      .from(syncSources)
      .where(eq(syncSources.id, source.id))
      .get();

    expect(result).toMatchObject({ fullResyncs: 1, errors: [] });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "syncToken=expired-token",
    );
    expect(String(fetchMock.mock.calls[1][0])).not.toContain("syncToken=");
    expect(updatedSource?.syncCursor).toBe("fresh-token");
  });

  it("handles cancelled normal and recurring Google events deliberately", async () => {
    createCalendarSource();
    const cancelled = createTask(db, userId, {
      description: "Will cancel",
      startAt: "2026-05-14T13:30:00.000Z",
    });
    createExternalLink(db, {
      userId,
      taskId: cancelled.id,
      provider: EXTERNAL_LINK_PROVIDER.googleCalendar,
      externalId: "work@example.com:cancel-me",
    });
    const master = createTask(db, userId, {
      description: "Weekly",
      startAt: "2026-05-07T13:00:00.000Z",
      endAt: "2026-05-07T13:30:00.000Z",
      recurrence: "FREQ=WEEKLY;BYDAY=TH",
      recurMode: "scheduled",
    });
    createExternalLink(db, {
      userId,
      taskId: master.id,
      provider: EXTERNAL_LINK_PROVIDER.googleCalendar,
      externalId: "work@example.com:series-1",
    });
    fetchCalendarEventsOnce([
      {
        id: "cancel-me",
        status: "cancelled",
        summary: "Cancelled",
        start: { dateTime: "2026-05-14T09:30:00-04:00" },
      },
      {
        id: "series-1_20260521",
        status: "cancelled",
        recurringEventId: "series-1",
        originalStartTime: { dateTime: "2026-05-21T09:00:00-04:00" },
        start: { dateTime: "2026-05-21T09:00:00-04:00" },
      },
    ]);

    const result = await pullGoogleCalendar(db, userId);
    const tasks = listTasks(db, userId);

    expect(result.cancelled).toBe(2);
    expect(tasks.find((task) => task.id === cancelled.id)).toMatchObject({
      status: "cancelled",
    });
    expect(
      JSON.parse(tasks.find((task) => task.id === master.id)?.exdates ?? "[]"),
    ).toEqual(["2026-05-21T13:00:00.000Z"]);
  });

  it("disconnect hard-removes Google Calendar imports and source state", () => {
    const source = createCalendarSource();
    const imported = createTask(db, userId, { description: "Imported" });
    const local = createTask(db, userId, { description: "Local" });
    createExternalLink(db, {
      userId,
      taskId: imported.id,
      syncSourceId: source.id,
      provider: EXTERNAL_LINK_PROVIDER.googleCalendar,
      externalId: "work@example.com:event-1",
    });

    disconnectGoogleIntegration(db, userId);

    expect(listTasks(db, userId)).toEqual([local]);
    expect(
      db
        .select()
        .from(taskExternalLinks)
        .where(eq(taskExternalLinks.userId, userId))
        .all(),
    ).toHaveLength(0);
    expect(db.select().from(syncSources).all()).toHaveLength(0);
  });
});
