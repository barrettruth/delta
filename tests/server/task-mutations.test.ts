import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXTERNAL_LINK_PROVIDER } from "@/core/external-link-providers";
import { createExternalLink } from "@/core/external-links";
import {
  createSyncSource,
  SYNC_SOURCE_KIND,
  SYNC_SOURCE_PROVIDER,
} from "@/core/sync-sources";
import {
  createTask,
  getTask,
  listTasks,
  updateTaskFromSync,
} from "@/core/task";
import type { Db } from "@/core/types";
import {
  addDependencyForUser,
  deleteTaskForUser,
  updateTaskForUser,
} from "@/server/task-mutations";
import { createTestDb, createTestUser } from "../helpers";

vi.mock("server-only", () => ({}));

let db: Db;
let userId: number;
let otherUserId: number;

function createReadOnlyImportedTask(description = "Imported") {
  const source = createSyncSource(db, {
    userId,
    provider: SYNC_SOURCE_PROVIDER.google,
    sourceKind: SYNC_SOURCE_KIND.googleTasksList,
    sourceId: "list-1",
    title: "Errands",
  });
  const task = createTask(db, userId, { description });
  createExternalLink(db, {
    userId,
    taskId: task.id,
    syncSourceId: source.id,
    provider: EXTERNAL_LINK_PROVIDER.googleTasks,
    externalId: `list-1:task-${task.id}`,
  });
  return task;
}

beforeEach(() => {
  db = createTestDb();
  userId = createTestUser(db).id;
  otherUserId = createTestUser(db).id;
});

describe("task mutation service", () => {
  it("updates only tasks owned by the user", () => {
    const task = createTask(db, userId, { description: "Owned" });
    const otherTask = createTask(db, otherUserId, { description: "Other" });

    const updated = updateTaskForUser(db, userId, task.id, {
      description: "Updated",
    });

    expect(updated.description).toBe("Updated");
    expect(() =>
      updateTaskForUser(db, userId, otherTask.id, {
        description: "Wrong owner",
      }),
    ).toThrow("Task not found");
    expect(getTask(db, otherTask.id)?.description).toBe("Other");
  });

  it("rejects user updates to read-only imported tasks", () => {
    const task = createReadOnlyImportedTask();

    expect(() =>
      updateTaskForUser(db, userId, task.id, {
        description: "User edit",
      }),
    ).toThrow("Imported provider tasks are read-only");
    expect(getTask(db, task.id)?.description).toBe("Imported");
  });

  it("allows explicit sync-engine updates to read-only imported tasks", () => {
    const task = createReadOnlyImportedTask();

    const updated = updateTaskFromSync(db, task.id, {
      description: "Remote edit",
      status: "done",
    });

    expect(updated).toMatchObject({
      description: "Remote edit",
      status: "done",
    });
  });

  it("rejects deletes and dependency edits for read-only imported tasks", () => {
    const task = createReadOnlyImportedTask();
    const local = createTask(db, userId, { description: "Local" });

    expect(() => deleteTaskForUser(db, userId, task.id)).toThrow(
      "Imported provider tasks are read-only",
    );
    expect(() => addDependencyForUser(db, userId, task.id, local.id)).toThrow(
      "Imported provider tasks are read-only",
    );
    expect(() => addDependencyForUser(db, userId, local.id, task.id)).toThrow(
      "Imported provider tasks are read-only",
    );
    expect(getTask(db, task.id)?.status).toBe("pending");
  });

  it("routes done status updates through recurring completion behavior", () => {
    const task = createTask(db, userId, {
      description: "Weekly review",
      due: "2026-05-11T12:00:00.000Z",
      recurrence: "FREQ=WEEKLY",
      recurMode: "scheduled",
    });

    const updated = updateTaskForUser(db, userId, task.id, { status: "done" });
    const tasks = listTasks(db, userId);

    expect(updated.status).toBe("done");
    expect(tasks).toHaveLength(2);
    expect(tasks.some((item) => item.status === "pending")).toBe(true);
  });

  it("requires owned dependency tasks before adding dependencies", () => {
    const task = createTask(db, userId, { description: "Owned" });
    const otherTask = createTask(db, otherUserId, { description: "Other" });

    expect(() =>
      addDependencyForUser(db, userId, task.id, otherTask.id),
    ).toThrow("Dependency task not found");
    expect(getTask(db, task.id)?.status).toBe("pending");
  });

  it("updates one recurrence instance through the shared scope flow", () => {
    const master = createTask(db, userId, {
      description: "Standup",
      startAt: "2026-05-11T14:00:00.000Z",
      endAt: "2026-05-11T14:30:00.000Z",
      recurrence: "FREQ=WEEKLY",
      recurMode: "scheduled",
    });
    const instanceDate = "2026-05-18T14:00:00.000Z";

    const exception = updateTaskForUser(
      db,
      userId,
      master.id,
      { description: "Moved standup" },
      { scope: "this", instanceDate },
    );

    expect(exception.recurringTaskId).toBe(master.id);
    expect(exception.description).toBe("Moved standup");
    expect(JSON.parse(getTask(db, master.id)?.exdates ?? "[]")).toContain(
      instanceDate,
    );
  });

  it("keeps recurrence delete response shape outside the service", () => {
    const master = createTask(db, userId, {
      description: "Standup",
      startAt: "2026-05-11T14:00:00.000Z",
      recurrence: "FREQ=WEEKLY",
      recurMode: "scheduled",
    });
    const instanceDate = "2026-05-18T14:00:00.000Z";

    const result = deleteTaskForUser(db, userId, master.id, {
      scope: "this",
      instanceDate,
    });

    expect(result).toEqual({ kind: "recurrence-scope", scope: "this" });
    expect(JSON.parse(getTask(db, master.id)?.exdates ?? "[]")).toContain(
      instanceDate,
    );
  });
});
