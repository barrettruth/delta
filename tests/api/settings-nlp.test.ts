import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SafeUser } from "@/core/auth";
import {
  getIntegrationConfig,
  upsertIntegrationConfig,
} from "@/core/integration-config";
import { nlpProviderKey, nlpTokens } from "@/core/provider-registry";
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
  getAuthUser: vi.fn(async () => state.user),
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}));

const TEST_KEY = randomBytes(32).toString("hex");

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("/api/settings/nlp", () => {
  beforeEach(() => {
    vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
    state.db = createTestDb();
    state.user = createTestUser(state.db, "settingsnlp");
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("stores the selected provider token under the parser contract", async () => {
    const { GET, PUT } = await import("@/app/api/settings/nlp/route");

    const response = await PUT(
      new Request("http://delta.test/api/settings/nlp", {
        method: "PUT",
        body: JSON.stringify({
          provider: "anthropic",
          apiKey: "test-secret",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(json(response)).resolves.toMatchObject({
      ok: true,
      provider: "anthropic",
      model: "claude-haiku-4-5-latest",
    });

    const config = getIntegrationConfig(
      state.db,
      state.user.id,
      nlpProviderKey("anthropic"),
    );
    expect(config?.tokens).toEqual({ api_key: "test-secret" });
    expect(config?.tokens).not.toHaveProperty("apiKey");

    const settings = await json(await GET());
    expect(settings.activeProvider).toBe("anthropic");
    expect(settings.anthropicConfigured).toBe(true);
    expect(JSON.stringify(settings)).not.toContain("test-secret");
  });

  it("selects one enabled provider and disables the previous NLP provider", async () => {
    const { PATCH } = await import("@/app/api/settings/nlp/route");
    upsertIntegrationConfig(
      state.db,
      state.user.id,
      nlpProviderKey("anthropic"),
      nlpTokens("test-secret"),
    );
    upsertIntegrationConfig(
      state.db,
      state.user.id,
      nlpProviderKey("openai"),
      nlpTokens("test-secret"),
    );

    const response = await PATCH(
      new Request("http://delta.test/api/settings/nlp", {
        method: "PATCH",
        body: JSON.stringify({ provider: "openai" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(
      getIntegrationConfig(state.db, state.user.id, nlpProviderKey("openai"))
        ?.enabled,
    ).toBe(1);
    expect(
      getIntegrationConfig(state.db, state.user.id, nlpProviderKey("anthropic"))
        ?.enabled,
    ).toBe(0);
  });

  it("does not mark a provider active when the stored token is missing", async () => {
    const { GET } = await import("@/app/api/settings/nlp/route");
    upsertIntegrationConfig(
      state.db,
      state.user.id,
      nlpProviderKey("anthropic"),
      {},
    );

    const settings = await json(await GET());

    expect(settings.activeProvider).toBeNull();
    expect(settings.anthropicConfigured).toBe(false);
  });
});
