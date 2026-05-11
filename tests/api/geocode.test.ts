import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SafeUser } from "@/core/auth";
import {
  type IntegrationConfig,
  upsertIntegrationConfig,
} from "@/core/integration-config";
import type { Db } from "@/core/types";
import { geocodingTokens } from "@/lib/geocoding-providers";
import { createTestDb, createTestUser } from "../helpers";

const state = vi.hoisted(() => ({
  db: undefined as unknown as Db,
  user: undefined as unknown as SafeUser,
}));

vi.mock("@/db", () => ({
  get db() {
    return state.db;
  },
}));

vi.mock("@/lib/auth-middleware", () => ({
  getAuthUserFromRequest: vi.fn(async () => state.user),
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));

const TEST_KEY = randomBytes(32).toString("hex");

function saveGeocodingProvider(
  provider: string,
  tokens: Record<string, unknown>,
): IntegrationConfig {
  return upsertIntegrationConfig(state.db, state.user.id, provider, tokens);
}

describe("GET /api/geocode", () => {
  beforeEach(() => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
    state.db = createTestDb();
    state.user = createTestUser(state.db, "geocodeapi");
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses Photon on a no-credential fresh instance", async () => {
    const { GET } = await import("@/app/api/geocode/route");
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

  it("uses the selected token-backed provider without exposing the token", async () => {
    const { GET } = await import("@/app/api/geocode/route");
    saveGeocodingProvider("mapbox", geocodingTokens("stored-mapbox-token"));
    const fetchMock = vi.fn(async () =>
      Response.json({
        features: [
          {
            properties: {
              name: "Central Library",
              full_address: "Central Library, Austin, Texas",
            },
            geometry: { coordinates: [-97.742, 30.265] },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://delta.test/api/geocode?q=Central Library"),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mapbox.com/search/geocode/v6/forward?q=Central%20Library&access_token=stored-mapbox-token&limit=10",
    );
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("stored-mapbox-token");
    expect(body).toEqual([
      {
        name: "Central Library",
        displayName: "Central Library, Austin, Texas",
        lat: 30.265,
        lon: -97.742,
      },
    ]);
  });

  it("returns a visible non-credential failure when lookup fails", async () => {
    const { GET } = await import("@/app/api/geocode/route");
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
