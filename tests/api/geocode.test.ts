import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/geocode/route";

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
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/geocode", () => {
  it("uses Photon even when a paid provider env token exists", async () => {
    vi.stubEnv("MAPBOX_ACCESS_TOKEN", "paid-provider-token");
    const fetchMock = vi.fn(async () =>
      Response.json({
        features: [
          {
            properties: {
              name: "New York",
              state: "New York",
              country: "United States",
            },
            geometry: { coordinates: [-74.006, 40.7128] },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://delta.test/api/geocode?q=New York"),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://photon.komoot.io/api?q=New%20York&limit=10",
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        name: "New York",
        displayName: "New York, New York, United States",
        lat: 40.7128,
        lon: -74.006,
      },
    ]);
  });

  it("returns a visible non-credential failure when Photon is unavailable", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://delta.test/api/geocode?q=Berlin"),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Geocoding request failed",
    });
  });
});
