import { afterEach, describe, expect, it, vi } from "vitest";

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
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("POST /api/settings/integrations/test", () => {
  it("tests Mapbox through the shared geocoding provider contract", async () => {
    const { POST } = await import("@/app/api/settings/integrations/test/route");
    const fetchMock = vi.fn(async () => Response.json({ features: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://delta.test/api/settings/integrations/test", {
        method: "POST",
        body: JSON.stringify({
          provider: "mapbox",
          apiKey: "mapbox-token",
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mapbox.com/search/geocode/v6/forward?q=test&access_token=mapbox-token&limit=10",
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
      new Request("http://delta.test/api/settings/integrations/test", {
        method: "POST",
        body: JSON.stringify({
          provider: "google_maps",
          apiKey: "google-token",
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://maps.googleapis.com/maps/api/geocode/json?address=test&key=google-token",
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      valid: false,
      error: "invalid api key",
    });
  });

  it("does not require a Photon credential test", async () => {
    const { POST } = await import("@/app/api/settings/integrations/test/route");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://delta.test/api/settings/integrations/test", {
        method: "POST",
        body: JSON.stringify({
          provider: "photon",
          apiKey: "not-used",
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
