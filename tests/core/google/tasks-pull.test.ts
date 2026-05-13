import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXTERNAL_LINK_PROVIDER } from "@/core/external-link-providers";
import {
  createExternalLink,
  listExternalLinksForTask,
} from "@/core/external-links";
import { pullGoogleTasks } from "@/core/google/tasks-pull";
import { upsertIntegrationConfig } from "@/core/integration-config";
import { createTask, listTasks, updateTask } from "@/core/task";
import type { Db } from "@/core/types";
import { taskExternalLinks } from "@/db/schema";
import { createTestDb, createTestUser } from "../../helpers";

const TEST_KEY = randomBytes(32).toString("hex");

let db: Db;
let userId: number;

function googleResponse(body: Record<string, unknown>) {
  return Response.json(body);
}

function connectGoogle() {
  upsertIntegrationConfig(db, userId, "google", {
    accessToken: "access-token",
    refreshToken: "refresh-token",
  });
}

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    description: "Old title",
    notes: null,
    due: "2026-05-14",
    status: "pending",
    completedAt: null,
    category: "Todo",
    ...overrides,
  };
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
  it("creates and idempotently skips Google Tasks by external link", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        googleResponse({ items: [{ id: "list-1", title: "Errands" }] }),
      )
      .mockResolvedValueOnce(
        googleResponse({
          items: [
            {
              id: "task-1",
              title: "Buy milk",
              notes: "Remember oat milk",
              status: "needsAction",
              due: "2026-05-14T00:00:00.000Z",
              updated: "2026-05-11T12:00:00.000Z",
              etag: "etag-1",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        googleResponse({ items: [{ id: "list-1", title: "Errands" }] }),
      )
      .mockResolvedValueOnce(
        googleResponse({
          items: [
            {
              id: "task-1",
              title: "Buy milk",
              notes: "Remember oat milk",
              status: "needsAction",
              due: "2026-05-14T00:00:00.000Z",
              updated: "2026-05-11T12:00:00.000Z",
              etag: "etag-1",
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const first = await pullGoogleTasks(db, userId);
    const second = await pullGoogleTasks(db, userId);

    expect(first).toMatchObject({ created: 1, updated: 0, skipped: 0 });
    expect(second).toMatchObject({ created: 0, updated: 0, skipped: 1 });
    const tasks = listTasks(db, userId);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      description: "Buy milk",
      category: "Errands",
      due: "2026-05-14",
    });
    const links = listExternalLinksForTask(db, tasks[0].id);
    expect(links[0]).toMatchObject({
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "list-1:task-1",
    });
    expect(JSON.parse(links[0].metadata ?? "{}")).toMatchObject({
      syncState: "clean",
      changedFields: [],
      appliedSnapshot: {
        description: "Buy milk",
        due: "2026-05-14",
        status: "pending",
        category: "Errands",
      },
    });
  });

  it("updates imported tasks without spawning recurrence follow-ups", async () => {
    const existing = createTask(db, userId, {
      description: "Existing recurring task",
      recurrence: "FREQ=WEEKLY",
      due: "2026-05-14",
    });
    createExternalLink(db, {
      userId,
      taskId: existing.id,
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "list-1:task-1",
      metadata: {
        etag: "old",
        syncState: "clean",
        changedFields: [],
        appliedSnapshot: snapshot({
          description: "Existing recurring task",
        }),
      },
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          googleResponse({ items: [{ id: "list-1", title: "Errands" }] }),
        )
        .mockResolvedValueOnce(
          googleResponse({
            items: [
              {
                id: "task-1",
                title: "Done remotely",
                status: "completed",
                completed: "2026-05-11T12:30:00.000Z",
                due: "2026-05-14T00:00:00.000Z",
                updated: "2026-05-11T12:00:00.000Z",
                etag: "new",
              },
            ],
          }),
        ),
    );

    const result = await pullGoogleTasks(db, userId);
    const tasks = listTasks(db, userId);

    expect(result.updated).toBe(1);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      description: "Done remotely",
      status: "done",
      completedAt: "2026-05-11T12:30:00.000Z",
    });
  });

  it("clears mapped fields when Google removes them", async () => {
    const existing = createTask(db, userId, {
      description: "Old title",
      due: "2026-05-14",
      notes: JSON.stringify({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Old note" }] },
        ],
      }),
    });
    createExternalLink(db, {
      userId,
      taskId: existing.id,
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "list-1:task-1",
      metadata: {
        etag: "old",
        syncState: "clean",
        changedFields: [],
        appliedSnapshot: snapshot({
          description: "Old title",
          notes: JSON.stringify({
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "Old note" }],
              },
            ],
          }),
        }),
      },
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          googleResponse({ items: [{ id: "list-1", title: "Errands" }] }),
        )
        .mockResolvedValueOnce(
          googleResponse({
            items: [
              {
                id: "task-1",
                title: "No due or notes",
                status: "needsAction",
                updated: "2026-05-11T12:00:00.000Z",
                etag: "new",
              },
            ],
          }),
        ),
    );

    const result = await pullGoogleTasks(db, userId);
    const tasks = listTasks(db, userId);

    expect(result.updated).toBe(1);
    expect(tasks[0]).toMatchObject({
      description: "No due or notes",
      due: null,
      notes: null,
    });
  });

  it("does not create new local tasks for unseen remote deletions", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          googleResponse({ items: [{ id: "list-1", title: "Errands" }] }),
        )
        .mockResolvedValueOnce(
          googleResponse({
            items: [
              {
                id: "task-1",
                title: "Deleted before import",
                deleted: true,
                updated: "2026-05-11T12:00:00.000Z",
                etag: "deleted",
              },
            ],
          }),
        ),
    );

    const result = await pullGoogleTasks(db, userId);

    expect(result).toMatchObject({ created: 0, skipped: 1 });
    expect(listTasks(db, userId)).toHaveLength(0);
  });

  it("keeps identical Google task ids distinct across lists", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          googleResponse({
            items: [
              { id: "work", title: "Work" },
              { id: "home", title: "Home" },
            ],
          }),
        )
        .mockResolvedValueOnce(
          googleResponse({
            items: [
              {
                id: "task-1",
                title: "Submit report",
                status: "needsAction",
                updated: "2026-05-11T12:00:00.000Z",
              },
            ],
          }),
        )
        .mockResolvedValueOnce(
          googleResponse({
            items: [
              {
                id: "task-1",
                title: "Buy coffee",
                status: "needsAction",
                updated: "2026-05-11T12:05:00.000Z",
              },
            ],
          }),
        ),
    );

    const result = await pullGoogleTasks(db, userId);
    const tasks = listTasks(db, userId);
    const externalIds = tasks
      .flatMap((task) => listExternalLinksForTask(db, task.id))
      .map((link) => link.externalId)
      .sort();

    expect(result).toMatchObject({ created: 2, seen: 2 });
    expect(tasks).toHaveLength(2);
    expect(externalIds).toEqual(["home:task-1", "work:task-1"]);
  });

  it("applies remote-only changes and advances the applied snapshot", async () => {
    const existing = createTask(db, userId, {
      description: "Buy milk",
      due: "2026-05-14",
      category: "Errands",
    });
    createExternalLink(db, {
      userId,
      taskId: existing.id,
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "list-1:task-1",
      metadata: {
        etag: "old",
        updated: "2026-05-11T12:00:00.000Z",
        syncState: "clean",
        changedFields: [],
        appliedSnapshot: snapshot({
          description: "Buy milk",
          due: "2026-05-14",
          category: "Errands",
        }),
      },
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          googleResponse({ items: [{ id: "list-1", title: "Errands" }] }),
        )
        .mockResolvedValueOnce(
          googleResponse({
            items: [
              {
                id: "task-1",
                title: "Buy oat milk",
                status: "needsAction",
                due: "2026-05-15T00:00:00.000Z",
                updated: "2026-05-12T12:00:00.000Z",
                etag: "new",
              },
            ],
          }),
        ),
    );

    const result = await pullGoogleTasks(db, userId);
    const task = listTasks(db, userId)[0];

    expect(result).toMatchObject({ updated: 1, conflicts: 0, keptLocal: 0 });
    expect(task).toMatchObject({
      description: "Buy oat milk",
      due: "2026-05-15",
    });
    expect(googleTaskLinkMetadata(task.id)).toMatchObject({
      syncState: "clean",
      appliedSnapshot: {
        description: "Buy oat milk",
        due: "2026-05-15",
      },
    });
  });

  it("detects local-only edits even when Google returns no changed tasks", async () => {
    const existing = createTask(db, userId, {
      description: "Buy milk",
      due: "2026-05-14",
      category: "Errands",
    });
    createExternalLink(db, {
      userId,
      taskId: existing.id,
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "list-1:task-1",
      metadata: {
        etag: "etag-1",
        updated: "2026-05-11T12:00:00.000Z",
        syncState: "clean",
        changedFields: [],
        listId: "list-1",
        appliedSnapshot: snapshot({
          description: "Buy milk",
          due: "2026-05-14",
          category: "Errands",
        }),
      },
    });
    updateTask(db, existing.id, { due: "2026-05-15" });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          googleResponse({ items: [{ id: "list-1", title: "Errands" }] }),
        )
        .mockResolvedValueOnce(googleResponse({ items: [] })),
    );

    const result = await pullGoogleTasks(db, userId);
    const task = listTasks(db, userId)[0];

    expect(result).toMatchObject({ keptLocal: 1, updated: 0 });
    expect(task.due).toBe("2026-05-15");
    expect(googleTaskLinkMetadata(task.id)).toMatchObject({
      syncState: "local_modified",
      changedFields: ["due"],
    });
  });

  it("advances cleanly when local and remote changed to the same value", async () => {
    const existing = createTask(db, userId, {
      description: "Buy milk",
      due: "2026-05-14",
      category: "Errands",
    });
    createExternalLink(db, {
      userId,
      taskId: existing.id,
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "list-1:task-1",
      metadata: {
        etag: "old",
        syncState: "clean",
        changedFields: [],
        appliedSnapshot: snapshot({
          description: "Buy milk",
          due: "2026-05-14",
          category: "Errands",
        }),
      },
    });
    updateTask(db, existing.id, { description: "Buy oat milk" });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          googleResponse({ items: [{ id: "list-1", title: "Errands" }] }),
        )
        .mockResolvedValueOnce(
          googleResponse({
            items: [
              {
                id: "task-1",
                title: "Buy oat milk",
                status: "needsAction",
                due: "2026-05-14T00:00:00.000Z",
                updated: "2026-05-12T12:00:00.000Z",
                etag: "new",
              },
            ],
          }),
        ),
    );

    const result = await pullGoogleTasks(db, userId);
    const metadata = googleTaskLinkMetadata(existing.id);

    expect(result).toMatchObject({ conflicts: 0, keptLocal: 0 });
    expect(metadata).toMatchObject({
      syncState: "clean",
      changedFields: [],
      appliedSnapshot: {
        description: "Buy oat milk",
      },
    });
  });

  it("keeps local values and records conflicts when both sides diverge", async () => {
    const existing = createTask(db, userId, {
      description: "Buy milk",
      due: "2026-05-14",
      category: "Errands",
    });
    createExternalLink(db, {
      userId,
      taskId: existing.id,
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "list-1:task-1",
      metadata: {
        etag: "old",
        syncState: "clean",
        changedFields: [],
        appliedSnapshot: snapshot({
          description: "Buy milk",
          due: "2026-05-14",
          category: "Errands",
        }),
      },
    });
    updateTask(db, existing.id, { description: "Buy almond milk" });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          googleResponse({ items: [{ id: "list-1", title: "Errands" }] }),
        )
        .mockResolvedValueOnce(
          googleResponse({
            items: [
              {
                id: "task-1",
                title: "Buy oat milk",
                status: "needsAction",
                due: "2026-05-14T00:00:00.000Z",
                updated: "2026-05-12T12:00:00.000Z",
                etag: "new",
              },
            ],
          }),
        ),
    );

    const result = await pullGoogleTasks(db, userId);
    const task = listTasks(db, userId)[0];
    const metadata = googleTaskLinkMetadata(task.id);

    expect(result).toMatchObject({ conflicts: 1, updated: 0 });
    expect(task.description).toBe("Buy almond milk");
    expect(metadata).toMatchObject({
      syncState: "conflict",
      changedFields: ["description"],
      remoteSnapshot: {
        description: "Buy oat milk",
      },
    });
  });

  it("protects locally changed tasks from remote deletion", async () => {
    const existing = createTask(db, userId, {
      description: "Buy milk",
      due: "2026-05-14",
      category: "Errands",
    });
    createExternalLink(db, {
      userId,
      taskId: existing.id,
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "list-1:task-1",
      metadata: {
        etag: "old",
        syncState: "clean",
        changedFields: [],
        appliedSnapshot: snapshot({
          description: "Buy milk",
          due: "2026-05-14",
          category: "Errands",
        }),
      },
    });
    updateTask(db, existing.id, { due: "2026-05-15" });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          googleResponse({ items: [{ id: "list-1", title: "Errands" }] }),
        )
        .mockResolvedValueOnce(
          googleResponse({
            items: [
              {
                id: "task-1",
                title: "Buy milk",
                deleted: true,
                updated: "2026-05-12T12:00:00.000Z",
                etag: "deleted",
              },
            ],
          }),
        ),
    );

    const result = await pullGoogleTasks(db, userId);
    const task = listTasks(db, userId)[0];

    expect(result).toMatchObject({
      cancelled: 0,
      remoteOutdated: 1,
      deletedProtected: 1,
    });
    expect(task).toMatchObject({ status: "pending", due: "2026-05-15" });
    expect(googleTaskLinkMetadata(task.id)).toMatchObject({
      syncState: "remote_outdated",
      changedFields: expect.arrayContaining(["due", "status"]),
      remoteSnapshot: {
        status: "cancelled",
      },
    });
  });

  it("cancels clean remote deletions without erasing local descriptive fields", async () => {
    const existing = createTask(db, userId, {
      description: "Buy milk",
      notes: JSON.stringify({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Keep note" }] },
        ],
      }),
      due: "2026-05-14",
      category: "Errands",
    });
    createExternalLink(db, {
      userId,
      taskId: existing.id,
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "list-1:task-1",
      metadata: {
        etag: "old",
        syncState: "clean",
        changedFields: [],
        listId: "list-1",
        appliedSnapshot: snapshot({
          description: "Buy milk",
          notes: existing.notes,
          due: "2026-05-14",
          category: "Errands",
        }),
      },
    });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          googleResponse({ items: [{ id: "list-1", title: "Errands" }] }),
        )
        .mockResolvedValueOnce(
          googleResponse({
            items: [
              {
                id: "task-1",
                deleted: true,
                updated: "2026-05-12T12:00:00.000Z",
                etag: "deleted",
              },
            ],
          }),
        ),
    );

    const result = await pullGoogleTasks(db, userId);
    const task = listTasks(db, userId)[0];

    expect(result).toMatchObject({ cancelled: 1, updated: 0 });
    expect(task).toMatchObject({
      description: "Buy milk",
      notes: existing.notes,
      due: "2026-05-14",
      category: "Errands",
      status: "cancelled",
    });
  });

  it("applies held remote snapshots after local conflicts are reverted", async () => {
    const existing = createTask(db, userId, {
      description: "Buy almond milk",
      due: "2026-05-14",
      category: "Errands",
    });
    createExternalLink(db, {
      userId,
      taskId: existing.id,
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "list-1:task-1",
      metadata: {
        etag: "new",
        updated: "2026-05-12T12:00:00.000Z",
        syncState: "conflict",
        changedFields: ["description"],
        listId: "list-1",
        appliedSnapshot: snapshot({
          description: "Buy milk",
          due: "2026-05-14",
          category: "Errands",
        }),
        remoteSnapshot: snapshot({
          description: "Buy oat milk",
          due: "2026-05-14",
          category: "Errands",
        }),
      },
    });
    updateTask(db, existing.id, { description: "Buy milk" });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          googleResponse({ items: [{ id: "list-1", title: "Errands" }] }),
        )
        .mockResolvedValueOnce(googleResponse({ items: [] })),
    );

    const result = await pullGoogleTasks(db, userId);
    const task = listTasks(db, userId)[0];

    expect(result).toMatchObject({ updated: 1, conflicts: 0 });
    expect(task.description).toBe("Buy oat milk");
    expect(googleTaskLinkMetadata(task.id)).toMatchObject({
      syncState: "clean",
      remoteSnapshot: null,
      appliedSnapshot: {
        description: "Buy oat milk",
      },
    });
  });

  it("does not audit links for lists that were not returned by Google", async () => {
    const existing = createTask(db, userId, {
      description: "Buy milk",
      due: "2026-05-14",
      category: "Errands",
    });
    createExternalLink(db, {
      userId,
      taskId: existing.id,
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "missing-list:task-1",
      metadata: {
        etag: "etag-1",
        updated: "2026-05-11T12:00:00.000Z",
        syncState: "clean",
        changedFields: [],
        listId: "missing-list",
        appliedSnapshot: snapshot({
          description: "Buy milk",
          due: "2026-05-14",
          category: "Errands",
        }),
      },
    });
    updateTask(db, existing.id, { due: "2026-05-15" });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          googleResponse({ items: [{ id: "other-list", title: "Other" }] }),
        )
        .mockResolvedValueOnce(googleResponse({ items: [] })),
    );

    const result = await pullGoogleTasks(db, userId);

    expect(result).toMatchObject({ keptLocal: 0, skipped: 0 });
    expect(googleTaskLinkMetadata(existing.id)).toMatchObject({
      syncState: "clean",
    });
  });

  it("keeps local data when stored Google metadata is malformed", async () => {
    const existing = createTask(db, userId, {
      description: "Old title",
      due: "2026-05-10",
    });
    const link = createExternalLink(db, {
      userId,
      taskId: existing.id,
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "list-1:task-1",
      metadata: { etag: "etag-1" },
    });
    db.update(taskExternalLinks)
      .set({ metadata: "{not-json" })
      .where(eq(taskExternalLinks.id, link.id))
      .run();

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          googleResponse({ items: [{ id: "list-1", title: "Errands" }] }),
        )
        .mockResolvedValueOnce(
          googleResponse({
            items: [
              {
                id: "task-1",
                title: "Fresh title",
                status: "needsAction",
                due: "2026-05-15T00:00:00.000Z",
                updated: "2026-05-11T12:00:00.000Z",
                etag: "etag-1",
              },
            ],
          }),
        ),
    );

    const result = await pullGoogleTasks(db, userId);
    const tasks = listTasks(db, userId);

    expect(result).toMatchObject({ keptLocal: 1, updated: 0 });
    expect(tasks[0]).toMatchObject({
      description: "Old title",
      due: "2026-05-10",
    });
    expect(googleTaskLinkMetadata(tasks[0].id)).toMatchObject({
      syncState: "local_modified",
      remoteSnapshot: {
        description: "Fresh title",
      },
    });
  });
});
