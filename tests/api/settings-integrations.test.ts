import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SafeUser } from "@/core/auth";
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

vi.mock("@/lib/auth-middleware", () => ({
  getAuthUserFromRequest: vi.fn(async () => state.user),
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));

const TEST_KEY = randomBytes(32).toString("hex");

function request(body: Record<string, unknown>) {
  return new Request("http://delta.test/api/settings/integrations", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("POST /api/settings/integrations", () => {
  beforeEach(() => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
    state.db = createTestDb();
    state.user = createTestUser(state.db, "settingsintegrations");
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("accepts registered settings providers with the canonical token field", async () => {
    const { POST } = await import("@/app/api/settings/integrations/route");

    const response = await POST(
      request({
        provider: "mapbox",
        tokens: { api_key: "test-provider-key" },
      }),
    );

    expect(response.status).toBe(201);
    const body = await json(response);
    expect(body).toMatchObject({
      provider: "mapbox",
      enabled: 1,
    });
    expect(JSON.stringify(body)).not.toContain("test-provider-key");
  });

  it("rejects unregistered provider IDs and noncanonical token fields", async () => {
    const { POST } = await import("@/app/api/settings/integrations/route");

    expect(
      await json(
        await POST(
          request({
            provider: "unknown",
            tokens: { api_key: "test-provider-key" },
          }),
        ),
      ),
    ).toEqual({ error: "invalid provider" });

    const response = await POST(
      request({
        provider: "mapbox",
        tokens: { apiKey: "test-provider-key" },
      }),
    );

    expect(response.status).toBe(400);
    await expect(json(response)).resolves.toEqual({
      error: "api key is required",
    });
  });
});
