import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/settings/integrations/test/route";

vi.mock("@/lib/auth-middleware", () => ({
  getAuthUserFromRequest: vi.fn(async () => ({
    id: 1,
    username: "local",
    apiKey: "test-key",
    createdAt: new Date().toISOString(),
  })),
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/settings/integrations/test", () => {
  it("does not expose paid geocoding providers as testable integrations", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://delta.test/api/settings/integrations/test", {
        method: "POST",
        body: JSON.stringify({
          provider: "mapbox",
          apiKey: "paid-provider-token",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      valid: false,
      error: "invalid provider",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
