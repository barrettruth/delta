import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXTERNAL_LINK_PROVIDER } from "@/core/external-link-providers";
import {
  createExternalLink,
  listExternalLinksForTask,
} from "@/core/external-links";
import { disconnectGoogleIntegration } from "@/core/google/cleanup";
import { pullGoogleTasks } from "@/core/google/tasks-pull";
import { GOOGLE_PROVIDER } from "@/core/google/types";
import { upsertIntegrationConfig } from "@/core/integration-config";
import { createSyncSource, SYNC_SOURCE_KIND } from "@/core/sync-sources";
import { createTask, listTasks, updateTaskFromSync } from "@/core/task";
import type { Db } from "@/core/types";
import { syncSources, taskExternalLinks } from "@/db/schema";
import { updateTaskForUser } from "@/server/task-mutations";
import { createTestDb, createTestUser } from "../../helpers";

const TEST_KEY = randomBytes(32).toString("hex");

vi.mock("server-only", () => ({}));

let db: Db;
let userId: number;

function googleResponse(body: Record<string, unknown>) {
  return Response.json(body);
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

function fetchGoogleTasksOnce({
  lists = [{ id: "list-1", title: "Errands" }],
  tasks = [],
}: {
  lists?: Array<Record<string, unknown>>;
  tasks?: Array<Record<string, unknown>>;
}) {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(googleResponse({ items: lists }))
    .mockResolvedValueOnce(googleResponse({ items: tasks }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function googleTaskLinkMetadata(taskId: number): Record<string, unknown> {
  const link = listExternalLinksForTask(db, taskId).find(
    (item) => item.provider === EXTERNAL_LINK_PROVIDER.googleTasks,
  );
  if (!link?.metadata) return {};
  return JSON.parse(link.metadata) as Record<string, unknown>;
}

beforeEach(() => {
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
  db = createTestDb();
  userId = createTestUser(db, "googletasks").id;
  connectGoogle();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("pullGoogleTasks", () => {
  it("creates read-only Google Tasks imports and idempotently skips repeats", async () => {
    const taskPayload = {
      id: "task-1",
      title: "Buy milk",
      notes: "Remember oat milk",
      status: "needsAction",
      due: "2026-05-14T00:00:00.000Z",
      updated: "2026-05-11T12:00:00.000Z",
      etag: "etag-1",
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          googleResponse({ items: [{ id: "list-1", title: "Errands" }] }),
        )
        .mockResolvedValueOnce(googleResponse({ items: [taskPayload] }))
        .mockResolvedValueOnce(
          googleResponse({ items: [{ id: "list-1", title: "Errands" }] }),
        )
        .mockResolvedValueOnce(googleResponse({ items: [taskPayload] })),
    );

    const first = await pullGoogleTasks(db, userId);
    const second = await pullGoogleTasks(db, userId);
    const tasks = listTasks(db, userId);
    const links = listExternalLinksForTask(db, tasks[0].id);
    const source = db.select().from(syncSources).get();

    expect(first).toMatchObject({ created: 1, updated: 0, skipped: 0 });
    expect(second).toMatchObject({ created: 0, updated: 0, skipped: 1 });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      description: "Buy milk",
      category: "Errands",
      due: "2026-05-14",
    });
    expect(source).toMatchObject({
      provider: GOOGLE_PROVIDER,
      sourceKind: SYNC_SOURCE_KIND.googleTasksList,
      sourceId: "list-1",
      title: "Errands",
      readOnly: 1,
    });
    expect(links[0]).toMatchObject({
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "list-1:task-1",
      syncSourceId: source?.id,
    });
    expect(googleTaskLinkMetadata(tasks[0].id)).toMatchObject({
      readOnly: true,
      appliedSnapshot: {
        description: "Buy milk",
        due: "2026-05-14",
        status: "pending",
        category: "Errands",
      },
    });
  });

  it("updates existing imports from Google through the sync path", async () => {
    const source = createSyncSource(db, {
      userId,
      provider: GOOGLE_PROVIDER,
      sourceKind: SYNC_SOURCE_KIND.googleTasksList,
      sourceId: "list-1",
      title: "Errands",
    });
    const existing = createTask(db, userId, {
      description: "Old title",
      due: "2026-05-14",
    });
    createExternalLink(db, {
      userId,
      taskId: existing.id,
      syncSourceId: source.id,
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "list-1:task-1",
      metadata: { listId: "list-1" },
    });
    fetchGoogleTasksOnce({
      tasks: [
        {
          id: "task-1",
          title: "Done remotely",
          status: "completed",
          completed: "2026-05-11T12:30:00.000Z",
          due: "2026-05-15T00:00:00.000Z",
          updated: "2026-05-11T12:00:00.000Z",
          etag: "new",
        },
      ],
    });

    const result = await pullGoogleTasks(db, userId);
    const task = listTasks(db, userId)[0];

    expect(result).toMatchObject({ updated: 1, skipped: 0 });
    expect(task).toMatchObject({
      description: "Done remotely",
      status: "done",
      completedAt: "2026-05-11T12:30:00.000Z",
      due: "2026-05-15",
    });
  });

  it("migrates legacy list metadata and hardens existing imports as read-only", async () => {
    connectGoogle({
      tasks: {
        lists: {
          "list-1": { title: "Errands", updatedMin: "2026-05-10T00:00:00Z" },
        },
      },
    });
    const existing = createTask(db, userId, {
      description: "Local old title",
      due: "2026-05-14",
    });
    createExternalLink(db, {
      userId,
      taskId: existing.id,
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "list-1:task-1",
      metadata: { listId: "list-1" },
    });
    const fetchMock = fetchGoogleTasksOnce({
      tasks: [
        {
          id: "task-1",
          title: "Remote title",
          status: "needsAction",
          due: "2026-05-15T00:00:00.000Z",
          updated: "2026-05-11T12:00:00.000Z",
        },
      ],
    });

    const result = await pullGoogleTasks(db, userId);
    const task = listTasks(db, userId)[0];
    const link = listExternalLinksForTask(db, task.id)[0];
    const source = db.select().from(syncSources).get();

    expect(String(fetchMock.mock.calls[1][0])).toContain(
      "updatedMin=2026-05-10T00%3A00%3A00Z",
    );
    expect(result).toMatchObject({ updated: 1 });
    expect(task).toMatchObject({
      description: "Remote title",
      due: "2026-05-15",
    });
    expect(link.syncSourceId).toBe(source?.id);
    expect(() =>
      updateTaskForUser(db, userId, task.id, { description: "User edit" }),
    ).toThrow("Imported provider tasks are read-only");
    expect(
      updateTaskFromSync(db, task.id, { description: "Sync edit" }),
    ).toMatchObject({ description: "Sync edit" });
  });

  it("skips unseen remote deletions and cancels already imported deletions", async () => {
    const source = createSyncSource(db, {
      userId,
      provider: GOOGLE_PROVIDER,
      sourceKind: SYNC_SOURCE_KIND.googleTasksList,
      sourceId: "list-1",
      title: "Errands",
    });
    const existing = createTask(db, userId, {
      description: "Delete me",
      due: "2026-05-14",
    });
    createExternalLink(db, {
      userId,
      taskId: existing.id,
      syncSourceId: source.id,
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "list-1:task-1",
      metadata: { listId: "list-1" },
    });
    fetchGoogleTasksOnce({
      tasks: [
        {
          id: "task-1",
          deleted: true,
          updated: "2026-05-11T12:00:00.000Z",
        },
        {
          id: "task-2",
          deleted: true,
          updated: "2026-05-11T12:00:00.000Z",
        },
      ],
    });

    const result = await pullGoogleTasks(db, userId);

    expect(result).toMatchObject({ cancelled: 1, skipped: 1, created: 0 });
    expect(listTasks(db, userId)).toMatchObject([{ status: "cancelled" }]);
  });

  it("disconnect hard-removes Google Tasks imports and source state", () => {
    const source = createSyncSource(db, {
      userId,
      provider: GOOGLE_PROVIDER,
      sourceKind: SYNC_SOURCE_KIND.googleTasksList,
      sourceId: "list-1",
      title: "Errands",
    });
    const imported = createTask(db, userId, { description: "Imported" });
    const local = createTask(db, userId, { description: "Local" });
    createExternalLink(db, {
      userId,
      taskId: imported.id,
      syncSourceId: source.id,
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "list-1:task-1",
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
