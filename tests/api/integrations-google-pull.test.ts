import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: 7, username: "owner", apiKey: "key", createdAt: "now" },
}));

const pullGoogleTasks = vi.hoisted(() => vi.fn());

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/auth-responses", () => ({
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));
vi.mock("@/lib/request-auth", () => ({
  getApiKeyUserOrLocalOwnerFromRequest: vi.fn(async () => state.user),
}));
vi.mock("@/core/google/tasks-pull", () => ({ pullGoogleTasks }));

describe("POST /api/integrations/google/tasks/pull", () => {
  it("returns the pull summary", async () => {
    pullGoogleTasks.mockResolvedValue({
      lists: 1,
      seen: 2,
      created: 1,
      updated: 1,
      cancelled: 0,
      skipped: 0,
      keptLocal: 0,
      conflicts: 0,
      remoteOutdated: 0,
      deletedProtected: 0,
    });
    const { POST } = await import(
      "@/app/api/integrations/google/tasks/pull/route"
    );

    const response = await POST(
      new Request("http://delta.test/api/integrations/google/tasks/pull", {
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      created: 1,
      updated: 1,
      conflicts: 0,
    });
    expect(response.status).toBe(200);
    expect(pullGoogleTasks).toHaveBeenCalledWith({}, 7);
  });
});
