import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildGeocodingUrl,
  getActiveGeocodingConfig,
  parseGeocodingResults,
} from "@/core/geocoding";
import {
  getIntegrationConfig,
  upsertIntegrationConfig,
} from "@/core/integration-config";
import {
  GEOCODING_PROVIDERS,
  geocodingProvidersToClear,
  geocodingTokens,
  readGeocodingApiKey,
} from "@/core/provider-registry";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../helpers";

const TEST_KEY = randomBytes(32).toString("hex");

describe("geocoding provider contract", () => {
  let db: Db;
  let userId: number;

  beforeEach(() => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
    db = createTestDb();
    userId = createTestUser(db, "geocoding").id;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("centralizes current geocoding provider metadata", () => {
    expect(
      GEOCODING_PROVIDERS.map(({ id, label, requiresApiKey }) => ({
        id,
        label,
        requiresApiKey,
      })),
    ).toEqual([
      { id: "photon", label: "photon", requiresApiKey: false },
      { id: "mapbox", label: "mapbox", requiresApiKey: true },
      { id: "google_maps", label: "google maps", requiresApiKey: true },
    ]);

    expect(geocodingProvidersToClear("photon")).toEqual([
      "mapbox",
      "google_maps",
    ]);
    expect(geocodingProvidersToClear("mapbox")).toEqual([
      "google_maps",
      "photon",
    ]);
  });

  it("uses only the current api_key token field", () => {
    expect(geocodingTokens("test-secret")).toEqual({
      api_key: "test-secret",
    });
    expect(readGeocodingApiKey({ api_key: "  test-secret  " })).toBe(
      "test-secret",
    );
    expect(readGeocodingApiKey({ apiKey: "old-secret" })).toBeNull();
  });

  it("builds provider-specific lookup URLs", () => {
    expect(buildGeocodingUrl("photon", null, "New York")).toBe(
      "https://photon.komoot.io/api?q=New%20York&limit=10",
    );
    expect(buildGeocodingUrl("mapbox", "mapbox secret", "New York")).toBe(
      "https://api.mapbox.com/search/geocode/v6/forward?q=New%20York&access_token=mapbox%20secret&limit=10",
    );
    expect(buildGeocodingUrl("google_maps", "google secret", "New York")).toBe(
      "https://maps.googleapis.com/maps/api/geocode/json?address=New%20York&key=google%20secret",
    );
  });

  it("falls back to Photon when no credential is configured", () => {
    expect(getActiveGeocodingConfig(db, userId)).toEqual({
      provider: "photon",
      apiKey: null,
    });
  });

  it("uses current stored provider credentials before the env fallback", () => {
    vi.stubEnv("MAPBOX_ACCESS_TOKEN", "env-mapbox-token");
    upsertIntegrationConfig(
      db,
      userId,
      "mapbox",
      geocodingTokens("stored-mapbox-token"),
    );
    upsertIntegrationConfig(
      db,
      userId,
      "google_maps",
      geocodingTokens("stored-google-token"),
    );

    expect(getActiveGeocodingConfig(db, userId)).toEqual({
      provider: "google_maps",
      apiKey: "stored-google-token",
    });
  });

  it("lets an explicit Photon selection override the env fallback", () => {
    vi.stubEnv("MAPBOX_ACCESS_TOKEN", "env-mapbox-token");
    upsertIntegrationConfig(db, userId, "photon", {});

    expect(getActiveGeocodingConfig(db, userId)).toEqual({
      provider: "photon",
      apiKey: null,
    });
    expect(getIntegrationConfig(db, userId, "photon")?.tokens).toEqual({});
  });

  it("ignores geocoding token payload aliases outside the current contract", () => {
    upsertIntegrationConfig(db, userId, "mapbox", {
      apiKey: "old-mapbox-token",
    });

    expect(getActiveGeocodingConfig(db, userId)).toEqual({
      provider: "photon",
      apiKey: null,
    });
  });

  it("maps provider responses to location suggestions", () => {
    expect(
      parseGeocodingResults("photon", {
        features: [
          {
            properties: {
              name: "Central Library",
              city: "Austin",
              state: "Texas",
              country: "United States",
            },
            geometry: { coordinates: [-97.742, 30.265] },
          },
        ],
      }),
    ).toEqual([
      {
        name: "Central Library",
        displayName: "Central Library, Austin, Texas, United States",
        lat: 30.265,
        lon: -97.742,
      },
    ]);

    expect(
      parseGeocodingResults("mapbox", {
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
    ).toEqual([
      {
        name: "Central Library",
        displayName: "Central Library, Austin, Texas",
        lat: 30.265,
        lon: -97.742,
      },
    ]);

    expect(
      parseGeocodingResults("google_maps", {
        results: [
          {
            formatted_address: "Central Library, Austin, TX, USA",
            geometry: { location: { lat: 30.265, lng: -97.742 } },
            address_components: [
              { long_name: "Central Library", types: ["establishment"] },
            ],
          },
        ],
      }),
    ).toEqual([
      {
        name: "Central Library",
        displayName: "Central Library, Austin, TX, USA",
        lat: 30.265,
        lon: -97.742,
      },
    ]);
  });
});
