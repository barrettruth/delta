import { beforeEach, describe, expect, it } from "vitest";
import {
  EXTERNAL_LINK_PROVIDER,
  EXTERNAL_LINK_PROVIDERS,
  isExternalLinkProviderId,
} from "@/core/external-link-providers";
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
  it("defines accepted provider IDs without duplicates", () => {
    expect(EXTERNAL_LINK_PROVIDERS).toEqual([
      EXTERNAL_LINK_PROVIDER.ical,
      EXTERNAL_LINK_PROVIDER.googleCalendar,
      EXTERNAL_LINK_PROVIDER.googleTasks,
    ]);
    expect(new Set(EXTERNAL_LINK_PROVIDERS).size).toBe(
      EXTERNAL_LINK_PROVIDERS.length,
    );
    for (const provider of EXTERNAL_LINK_PROVIDERS) {
      expect(isExternalLinkProviderId(provider)).toBe(true);
    }
    expect(isExternalLinkProviderId("google")).toBe(false);
  });

  it("creates and fetches a link by provider/external id", () => {
    const task = createTask(db, userId, { description: "Imported event" });
    createExternalLink(db, {
      userId,
      taskId: task.id,
      provider: EXTERNAL_LINK_PROVIDER.ical,
      externalId: "uid@example.com",
    });

    const link = getExternalLinkByProviderId(
      db,
      userId,
      EXTERNAL_LINK_PROVIDER.ical,
      "uid@example.com",
    );
    expect(link?.taskId).toBe(task.id);
  });

  it("lists links for a task", () => {
    const task = createTask(db, userId, { description: "Imported event" });
    createExternalLink(db, {
      userId,
      taskId: task.id,
      provider: EXTERNAL_LINK_PROVIDER.ical,
      externalId: "uid@example.com",
    });

    const links = listExternalLinksForTask(db, task.id);
    expect(links).toHaveLength(1);
    expect(links[0].provider).toBe(EXTERNAL_LINK_PROVIDER.ical);
  });

  it("scopes external ids by provider", () => {
    const calendarTask = createTask(db, userId, {
      description: "Calendar event",
    });
    const tasksTask = createTask(db, userId, {
      description: "Google task",
    });

    createExternalLink(db, {
      userId,
      taskId: calendarTask.id,
      provider: EXTERNAL_LINK_PROVIDER.googleCalendar,
      externalId: "shared-id",
    });
    createExternalLink(db, {
      userId,
      taskId: tasksTask.id,
      provider: EXTERNAL_LINK_PROVIDER.googleTasks,
      externalId: "shared-id",
    });

    expect(
      getExternalLinkByProviderId(
        db,
        userId,
        EXTERNAL_LINK_PROVIDER.googleCalendar,
        "shared-id",
      )?.taskId,
    ).toBe(calendarTask.id);
    expect(
      getExternalLinkByProviderId(
        db,
        userId,
        EXTERNAL_LINK_PROVIDER.googleTasks,
        "shared-id",
      )?.taskId,
    ).toBe(tasksTask.id);
  });

  it("rejects duplicate provider and external id pairs for one user", () => {
    const firstTask = createTask(db, userId, { description: "First import" });
    const secondTask = createTask(db, userId, { description: "Second import" });

    createExternalLink(db, {
      userId,
      taskId: firstTask.id,
      provider: EXTERNAL_LINK_PROVIDER.ical,
      externalId: "uid@example.com",
    });

    expect(() =>
      createExternalLink(db, {
        userId,
        taskId: secondTask.id,
        provider: EXTERNAL_LINK_PROVIDER.ical,
        externalId: "uid@example.com",
      }),
    ).toThrow();
  });
});
