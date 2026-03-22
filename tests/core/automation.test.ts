import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRecipe,
  type RecipeHandler,
  registerRecipe,
  runAutomation,
} from "@/core/automation";
import type { Db } from "@/core/types";
import { automations } from "@/db/schema";
import { createTestDb } from "../helpers";

let db: Db;

function insertAutomation(
  db: Db,
  overrides: Partial<typeof automations.$inferInsert> = {},
) {
  const now = new Date().toISOString();
  return db
    .insert(automations)
    .values({
      name: "Test Automation",
      cron: "0 9 * * *",
      type: "test_recipe",
      config: JSON.stringify({ key: "value" }),
      enabled: 1,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning()
    .get();
}

beforeEach(() => {
  db = createTestDb();
});

describe("registerRecipe", () => {
  it("registers and retrieves a recipe handler", () => {
    const handler: RecipeHandler = async () => {};
    registerRecipe("my_type", handler);
    expect(getRecipe("my_type")).toBe(handler);
  });

  it("returns undefined for unregistered type", () => {
    expect(getRecipe("nonexistent_type")).toBeUndefined();
  });
});

describe("runAutomation", () => {
  it("throws for nonexistent automation", async () => {
    await expect(runAutomation(db, 999)).rejects.toThrow(
      "Automation 999 not found",
    );
  });

  it("throws for unknown recipe type", async () => {
    insertAutomation(db, { type: "totally_unknown" });
    await expect(runAutomation(db, 1)).rejects.toThrow(
      "Unknown recipe type: totally_unknown",
    );
  });

  it("runs the handler and updates last_run_at", async () => {
    const handler = vi.fn(async () => {});
    registerRecipe("test_recipe", handler);
    const automation = insertAutomation(db);

    expect(automation.lastRunAt).toBeNull();

    await runAutomation(db, automation.id);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(db, { key: "value" });

    const updated = db
      .select()
      .from(automations)
      .all()
      .find((a) => a.id === automation.id);
    expect(updated?.lastRunAt).toBeTruthy();
  });
});

describe("githubIssuesHandler", () => {
  it("creates tasks for open issues not authored by the token owner", async () => {
    const mockIssues = [
      {
        number: 1,
        title: "Bug in parser",
        labels: [{ name: "bug" }],
        user: { login: "someone-else" },
      },
      {
        number: 2,
        title: "My own issue",
        labels: [],
        user: { login: "barrettruth" },
      },
      {
        number: 3,
        title: "Feature request",
        labels: [{ name: "enhancement" }],
        user: { login: "contributor" },
        pull_request: { url: "..." },
      },
    ];

    const mockFetch = vi.fn(async (url: string) => {
      if (url === "https://api.github.com/user") {
        return {
          ok: true,
          json: async () => ({ login: "barrettruth" }),
        };
      }
      if (url.includes("/repos/owner/repo/issues")) {
        return {
          ok: true,
          json: async () => mockIssues,
        };
      }
      return { ok: false, status: 404 };
    });

    vi.stubGlobal("fetch", mockFetch);

    const config = {
      repos: ["owner/repo"],
      labels: ["bug"],
      category: "Open Source",
      token: "ghp_test",
    };

    const { githubIssuesHandler } = await import(
      "@/core/recipes/github-issues"
    );
    await githubIssuesHandler(db, config);

    const { tasks } = await import("@/db/schema");
    const allTasks = db.select().from(tasks).all();

    expect(allTasks).toHaveLength(1);
    expect(allTasks[0].description).toBe("[owner/repo] Bug in parser (#1)");
    expect(allTasks[0].category).toBe("Open Source");

    vi.unstubAllGlobals();
  });

  it("skips issues that already have a corresponding task", async () => {
    const { createTask } = await import("@/core/task");
    createTask(db, {
      description: "[owner/repo] Existing issue (#5)",
    });

    const mockFetch = vi.fn(async (url: string) => {
      if (url === "https://api.github.com/user") {
        return {
          ok: true,
          json: async () => ({ login: "barrettruth" }),
        };
      }
      if (url.includes("/repos/owner/repo/issues")) {
        return {
          ok: true,
          json: async () => [
            {
              number: 5,
              title: "Existing issue",
              labels: [],
              user: { login: "someone" },
            },
          ],
        };
      }
      return { ok: false, status: 404 };
    });

    vi.stubGlobal("fetch", mockFetch);

    const { githubIssuesHandler } = await import(
      "@/core/recipes/github-issues"
    );
    await githubIssuesHandler(db, {
      repos: ["owner/repo"],
      token: "ghp_test",
    });

    const { tasks } = await import("@/db/schema");
    const allTasks = db.select().from(tasks).all();
    expect(allTasks).toHaveLength(1);

    vi.unstubAllGlobals();
  });

  it("throws on invalid config", async () => {
    const { githubIssuesHandler } = await import(
      "@/core/recipes/github-issues"
    );
    await expect(githubIssuesHandler(db, { bad: true })).rejects.toThrow(
      "Invalid github_issues config",
    );
  });

  it("creates tasks without label filter", async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url === "https://api.github.com/user") {
        return {
          ok: true,
          json: async () => ({ login: "barrettruth" }),
        };
      }
      if (url.includes("/repos/owner/repo/issues")) {
        return {
          ok: true,
          json: async () => [
            {
              number: 10,
              title: "Unlabeled issue",
              labels: [],
              user: { login: "someone" },
            },
          ],
        };
      }
      return { ok: false, status: 404 };
    });

    vi.stubGlobal("fetch", mockFetch);

    const { githubIssuesHandler } = await import(
      "@/core/recipes/github-issues"
    );
    await githubIssuesHandler(db, {
      repos: ["owner/repo"],
      token: "ghp_test",
    });

    const { tasks } = await import("@/db/schema");
    const allTasks = db.select().from(tasks).all();
    expect(allTasks).toHaveLength(1);
    expect(allTasks[0].description).toBe("[owner/repo] Unlabeled issue (#10)");
    expect(allTasks[0].category).toBe("Todo");

    vi.unstubAllGlobals();
  });
});
