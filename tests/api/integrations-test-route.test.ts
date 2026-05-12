import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth-responses", () => ({
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));

vi.mock("@/lib/request-auth", () => ({
  getApiKeyUserOrLocalOwnerFromRequest: vi.fn(async () => ({
    id: 1,
    username: "local",
    apiKey: "test-user-key",
    createdAt: new Date().toISOString(),
  })),
}));

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

function request(body: Record<string, unknown>) {
  return new Request("http://delta.test/api/settings/integrations/test", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/settings/integrations/test", () => {
  it("rejects providers that are not testable settings integrations", async () => {
    const { POST } = await import("@/app/api/settings/integrations/test/route");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({ provider: "photon", apiKey: "test-provider-key" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      valid: false,
      error: "invalid provider",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tests Mapbox through the shared geocoding provider contract", async () => {
    const { POST } = await import("@/app/api/settings/integrations/test/route");
    const fetchMock = vi.fn(async () => Response.json({ features: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({ provider: "mapbox", apiKey: "test-provider-key" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mapbox.com/search/geocode/v6/forward?q=test&access_token=test-provider-key&limit=10",
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ valid: true });
  });

  it("keeps Google Maps test failures visible", async () => {
    const { POST } = await import("@/app/api/settings/integrations/test/route");
    const fetchMock = vi.fn(async () =>
      Response.json({ status: "REQUEST_DENIED" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({ provider: "google_maps", apiKey: "test-provider-key" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://maps.googleapis.com/maps/api/geocode/json?address=test&key=test-provider-key",
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      valid: false,
      error: "invalid api key",
    });
  });

  it("uses registry NLP defaults when no model override is supplied", async () => {
    const { POST } = await import("@/app/api/settings/integrations/test/route");
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({ provider: "openai", apiKey: "test-provider-key" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ valid: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        body: expect.stringContaining('"model":"gpt-4o-mini"'),
      }),
    );
  });
});
