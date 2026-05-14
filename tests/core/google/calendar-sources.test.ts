import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { listCategoryColors, setCategoryColor } from "@/core/categories";
import {
  listGoogleCalendarSources,
  setGoogleCalendarSourceEnabled,
  syncGoogleCalendarSources,
} from "@/core/google/calendar-sources";
import { GOOGLE_PROVIDER } from "@/core/google/types";
import { SYNC_SOURCE_KIND } from "@/core/sync-sources";
import type { Db } from "@/core/types";
import { syncSources } from "@/db/schema";
import { createTestDb, createTestUser } from "../../helpers";

let db: Db;
let userId: number;

beforeEach(() => {
  db = createTestDb();
  userId = createTestUser(db, "googlecalendars").id;
});

function metadata(sourceId: string): Record<string, unknown> {
  const source = db
    .select()
    .from(syncSources)
    .where(eq(syncSources.sourceId, sourceId))
    .get();
  return JSON.parse(source?.metadata ?? "{}") as Record<string, unknown>;
}

describe("Google Calendar source discovery", () => {
  it("creates selectable calendar sources and preserves existing category colors", () => {
    setCategoryColor(db, userId, "Work", "#existing");

    const sources = syncGoogleCalendarSources(db, userId, [
      {
        id: "work@example.com",
        summary: "Work",
        hidden: false,
        selected: true,
        accessRole: "owner",
        timeZone: "America/New_York",
        backgroundColor: "#2952a3",
        foregroundColor: "#ffffff",
      },
      {
        id: "archive@example.com",
        summary: "Archive",
        hidden: true,
        selected: false,
        accessRole: "reader",
        timeZone: "America/New_York",
        backgroundColor: "#7bd148",
        foregroundColor: "#000000",
      },
      {
        id: "readonly@example.com",
        summary: "Read Only",
        hidden: false,
        accessRole: "reader",
        timeZone: "America/Chicago",
        backgroundColor: "#f83a22",
      },
      {
        id: "freebusy@example.com",
        summary: "Busy Only",
        hidden: false,
        accessRole: "freeBusyReader",
        backgroundColor: "#000000",
      },
    ]);

    expect(sources.map((source) => source.title)).toEqual([
      "Archive",
      "Read Only",
      "Work",
    ]);
    expect(sources.find((source) => source.title === "Work")).toMatchObject({
      enabled: true,
      hidden: false,
      accessRole: "owner",
      defaultCategory: "Work",
      backgroundColor: "#2952a3",
    });
    expect(sources.find((source) => source.title === "Archive")).toMatchObject({
      enabled: false,
      hidden: true,
      accessRole: "reader",
    });
    expect(
      sources.find((source) => source.title === "Read Only"),
    ).toMatchObject({
      enabled: true,
      hidden: false,
      accessRole: "reader",
      timeZone: "America/Chicago",
    });
    expect(
      db
        .select()
        .from(syncSources)
        .where(eq(syncSources.sourceKind, SYNC_SOURCE_KIND.googleCalendar))
        .all(),
    ).toHaveLength(3);
    expect(metadata("archive@example.com")).toMatchObject({
      hidden: true,
      selected: false,
      accessRole: "reader",
      timeZone: "America/New_York",
    });
    expect(metadata("work@example.com")).toMatchObject({
      hidden: false,
      selected: true,
      googleSelected: true,
    });
    expect(listCategoryColors(db, userId)).toMatchObject({
      Work: "#existing",
      "Read Only": "#f83a22",
    });
    expect(listCategoryColors(db, userId).Archive).toBeUndefined();
  });

  it("keeps existing selections and can toggle a calendar source", () => {
    const [source] = syncGoogleCalendarSources(db, userId, [
      {
        id: "work@example.com",
        summary: "Work",
        hidden: false,
        accessRole: "owner",
        backgroundColor: "#2952a3",
      },
    ]);

    const disabled = setGoogleCalendarSourceEnabled(
      db,
      userId,
      source.id,
      false,
    );
    expect(disabled).toMatchObject({ enabled: false });
    expect(metadata("work@example.com")).toMatchObject({ selected: false });

    const rediscovered = syncGoogleCalendarSources(db, userId, [
      {
        id: "work@example.com",
        summary: "Renamed Work",
        hidden: false,
        accessRole: "writer",
        backgroundColor: "#2952a3",
      },
    ]);
    expect(rediscovered[0]).toMatchObject({
      title: "Renamed Work",
      enabled: false,
      defaultCategory: "Work",
      accessRole: "writer",
    });

    setGoogleCalendarSourceEnabled(db, userId, source.id, true);
    expect(listGoogleCalendarSources(db, userId)[0]).toMatchObject({
      enabled: true,
    });
    expect(
      db
        .select()
        .from(syncSources)
        .where(eq(syncSources.provider, GOOGLE_PROVIDER))
        .all(),
    ).toHaveLength(1);
  });
});
