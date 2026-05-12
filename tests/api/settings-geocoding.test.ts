import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SafeUser } from "@/core/auth";
import {
  getActiveGeocodingConfig,
  selectGeocodingProvider,
} from "@/core/geocoding";
import {
  getIntegrationConfig,
  upsertIntegrationConfig,
} from "@/core/integration-config";
import { geocodingTokens } from "@/core/provider-registry";
import type { Db } from "@/core/types";
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

vi.mock("@/lib/auth-responses", () => ({
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));

vi.mock("@/lib/request-auth", () => ({
  getApiKeyUserOrLocalOwnerFromRequest: vi.fn(async () => state.user),
}));

const TEST_KEY = randomBytes(32).toString("hex");

function request(body: Record<string, unknown>) {
  return new Request("http://delta.test/api/settings/geocoding", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("PUT /api/settings/geocoding", () => {
  beforeEach(() => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
    state.db = createTestDb();
    state.user = createTestUser(state.db, "settingsgeocoding");
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("selects one token-backed geocoding provider and removes stale configs", async () => {
    const { PUT } = await import("@/app/api/settings/geocoding/route");
    upsertIntegrationConfig(state.db, state.user.id, "photon", {});
    upsertIntegrationConfig(
      state.db,
      state.user.id,
      "google_maps",
      geocodingTokens("stale-google-key"),
    );

    const response = await PUT(
      request({ provider: "mapbox", apiKey: " test-mapbox-key " }),
    );

    expect(response.status).toBe(200);
    await expect(json(response)).resolves.toEqual({
      ok: true,
      provider: "mapbox",
      apiKeyConfigured: true,
    });
    expect(
      getIntegrationConfig(state.db, state.user.id, "mapbox")?.tokens,
    ).toEqual({ api_key: "test-mapbox-key" });
    expect(getIntegrationConfig(state.db, state.user.id, "photon")).toBeNull();
    expect(
      getIntegrationConfig(state.db, state.user.id, "google_maps"),
    ).toBeNull();
    expect(getActiveGeocodingConfig(state.db, state.user.id)).toEqual({
      provider: "mapbox",
      apiKey: "test-mapbox-key",
    });
  });

  it("selects Photon and removes stale token-backed providers", async () => {
    const { PUT } = await import("@/app/api/settings/geocoding/route");
    upsertIntegrationConfig(
      state.db,
      state.user.id,
      "mapbox",
      geocodingTokens("stale-mapbox-key"),
    );
    upsertIntegrationConfig(
      state.db,
      state.user.id,
      "google_maps",
      geocodingTokens("stale-google-key"),
    );

    const response = await PUT(request({ provider: "photon" }));

    expect(response.status).toBe(200);
    await expect(json(response)).resolves.toEqual({
      ok: true,
      provider: "photon",
      apiKeyConfigured: false,
    });
    expect(getIntegrationConfig(state.db, state.user.id, "photon")).toEqual(
      expect.objectContaining({
        provider: "photon",
        tokens: {},
        enabled: 1,
      }),
    );
    expect(getIntegrationConfig(state.db, state.user.id, "mapbox")).toBeNull();
    expect(
      getIntegrationConfig(state.db, state.user.id, "google_maps"),
    ).toBeNull();
  });

  it("rejects unknown providers and missing required api keys", async () => {
    const { PUT } = await import("@/app/api/settings/geocoding/route");

    const invalidProvider = await PUT(
      request({ provider: "unknown", apiKey: "test-key" }),
    );
    expect(invalidProvider.status).toBe(400);
    await expect(json(invalidProvider)).resolves.toEqual({
      error: "invalid geocoding provider",
    });

    const missingKey = await PUT(request({ provider: "mapbox" }));
    expect(missingKey.status).toBe(400);
    await expect(json(missingKey)).resolves.toEqual({
      error: "api key is required",
    });
  });
});

describe("selectGeocodingProvider", () => {
  beforeEach(() => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
    state.db = createTestDb();
    state.user = createTestUser(state.db, "selectgeocoding");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("validates against the registry before mutating configs", () => {
    expect(() =>
      selectGeocodingProvider(state.db, state.user.id, {
        provider: "not_registered",
      }),
    ).toThrow("invalid geocoding provider");
    expect(getActiveGeocodingConfig(state.db, state.user.id)).toEqual({
      provider: "photon",
      apiKey: null,
    });
  });
});
