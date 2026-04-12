import { beforeEach, describe, expect, it } from "vitest";
import {
  createExternalLink,
  getExternalLinkByProviderId,
  listExternalLinksForTask,
} from "@/core/external-links";
import { createTask } from "@/core/task";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../helpers";

let db: Db;
let userId: number;

beforeEach(() => {
  db = createTestDb();
  userId = createTestUser(db).id;
});

describe("external links", () => {
  it("creates and fetches a link by provider/external id", () => {
    const task = createTask(db, userId, { description: "Imported event" });
    createExternalLink(db, {
      userId,
      taskId: task.id,
      provider: "ical",
      externalId: "uid@example.com",
    });

    const link = getExternalLinkByProviderId(
      db,
      userId,
      "ical",
      "uid@example.com",
    );
    expect(link?.taskId).toBe(task.id);
  });

  it("lists links for a task", () => {
    const task = createTask(db, userId, { description: "Imported event" });
    createExternalLink(db, {
      userId,
      taskId: task.id,
      provider: "ical",
      externalId: "uid@example.com",
    });

    const links = listExternalLinksForTask(db, task.id);
    expect(links).toHaveLength(1);
    expect(links[0].provider).toBe("ical");
  });
});
