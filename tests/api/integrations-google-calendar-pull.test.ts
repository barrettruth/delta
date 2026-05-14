import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: 7, username: "owner", apiKey: "key", createdAt: "now" },
}));

const pullGoogleCalendar = vi.hoisted(() => vi.fn());

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/auth-responses", () => ({
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));
vi.mock("@/lib/request-auth", () => ({
  getApiKeyUserOrLocalOwnerFromRequest: vi.fn(async () => state.user),
}));
vi.mock("@/core/google/calendar-pull", () => ({ pullGoogleCalendar }));

describe("POST /api/integrations/google/calendar/pull", () => {
  it("returns the pull summary", async () => {
    pullGoogleCalendar.mockResolvedValue({
      sources: 1,
      seen: 2,
      created: 1,
      updated: 1,
      cancelled: 0,
      skipped: 0,
      duplicateSkipped: 0,
      fullResyncs: 0,
      errors: [],
    });
    const { POST } = await import(
      "@/app/api/integrations/google/calendar/pull/route"
    );

    const response = await POST(
      new Request("http://delta.test/api/integrations/google/calendar/pull", {
        method: "POST",
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      created: 1,
      updated: 1,
      errors: [],
    });
    expect(response.status).toBe(200);
    expect(pullGoogleCalendar).toHaveBeenCalledWith({}, 7);
  });
});
