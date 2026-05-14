import { beforeEach, describe, expect, it } from "vitest";
import { EXTERNAL_LINK_PROVIDER } from "@/core/external-link-providers";
import {
  createExternalLink,
  listExternalLinksForTask,
} from "@/core/external-links";
import {
  createSyncSource,
  deleteSyncSource,
  getSyncSourceByProviderSourceId,
  listSyncSources,
  SYNC_SOURCE_KIND,
  SYNC_SOURCE_PROVIDER,
  updateSyncSource,
  upsertSyncSource,
} from "@/core/sync-sources";
import { createTask } from "@/core/task";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../helpers";

let db: Db;
let userId: number;

beforeEach(() => {
  db = createTestDb();
  userId = createTestUser(db).id;
});

describe("sync sources", () => {
  it("creates and fetches provider source state", () => {
    const source = createSyncSource(db, {
      userId,
      provider: SYNC_SOURCE_PROVIDER.google,
      sourceKind: SYNC_SOURCE_KIND.googleTasksList,
      sourceId: "list-1",
      title: "Errands",
      defaultCategory: "Errands",
      syncCursor: "cursor-1",
      lastResult: { seen: 2, updated: 1 },
      metadata: { color: "#2855aa" },
    });

    const fetched = getSyncSourceByProviderSourceId(
      db,
      userId,
      SYNC_SOURCE_PROVIDER.google,
      SYNC_SOURCE_KIND.googleTasksList,
      "list-1",
    );

    expect(fetched?.id).toBe(source.id);
    expect(fetched?.readOnly).toBe(1);
    expect(fetched?.defaultCategory).toBe("Errands");
    expect(JSON.parse(fetched?.lastResult ?? "{}")).toEqual({
      seen: 2,
      updated: 1,
    });
    expect(JSON.parse(fetched?.metadata ?? "{}")).toEqual({
      color: "#2855aa",
    });
  });

  it("updates nullable sync state and filters by source kind", () => {
    const tasksSource = createSyncSource(db, {
      userId,
      provider: SYNC_SOURCE_PROVIDER.google,
      sourceKind: SYNC_SOURCE_KIND.googleTasksList,
      sourceId: "list-1",
      title: "Errands",
    });
    createSyncSource(db, {
      userId,
      provider: SYNC_SOURCE_PROVIDER.google,
      sourceKind: SYNC_SOURCE_KIND.googleCalendar,
      sourceId: "calendar-1",
      title: "Work",
    });

    const updated = updateSyncSource(db, tasksSource.id, {
      title: "Inbox",
      enabled: 0,
      syncCursor: null,
      lastError: "rate limited",
      metadata: null,
    });

    expect(updated).toMatchObject({
      title: "Inbox",
      enabled: 0,
      syncCursor: null,
      lastError: "rate limited",
      metadata: null,
    });
    expect(
      listSyncSources(db, userId, {
        provider: SYNC_SOURCE_PROVIDER.google,
        sourceKind: SYNC_SOURCE_KIND.googleTasksList,
      }).map((source) => source.id),
    ).toEqual([tasksSource.id]);
  });

  it("upserts by user, provider, kind, and source id", () => {
    const first = upsertSyncSource(db, {
      userId,
      provider: SYNC_SOURCE_PROVIDER.google,
      sourceKind: SYNC_SOURCE_KIND.googleTasksList,
      sourceId: "list-1",
      title: "Errands",
    });
    const second = upsertSyncSource(db, {
      userId,
      provider: SYNC_SOURCE_PROVIDER.google,
      sourceKind: SYNC_SOURCE_KIND.googleTasksList,
      sourceId: "list-1",
      title: "Renamed",
      lastSyncedAt: "2026-05-13T12:00:00.000Z",
    });

    expect(second.id).toBe(first.id);
    expect(second.title).toBe("Renamed");
    expect(second.lastSyncedAt).toBe("2026-05-13T12:00:00.000Z");
    expect(listSyncSources(db, userId)).toHaveLength(1);
  });

  it("deletes source rows without deleting imported task links", () => {
    const source = createSyncSource(db, {
      userId,
      provider: SYNC_SOURCE_PROVIDER.google,
      sourceKind: SYNC_SOURCE_KIND.googleTasksList,
      sourceId: "list-1",
      title: "Errands",
    });
    const task = createTask(db, userId, { description: "Imported" });
    createExternalLink(db, {
      userId,
      taskId: task.id,
      syncSourceId: source.id,
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "list-1:task-1",
    });

    expect(deleteSyncSource(db, source.id)).toBe(true);
    expect(listSyncSources(db, userId)).toHaveLength(0);
    expect(listExternalLinksForTask(db, task.id)).toMatchObject([
      {
        taskId: task.id,
        syncSourceId: null,
      },
    ]);
  });
});
