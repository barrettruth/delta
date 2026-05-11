import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getIntegrationConfig,
  listIntegrationConfigs,
  setIntegrationEnabled,
  upsertIntegrationConfig,
} from "@/core/integration-config";
import { getActiveNlpConfig } from "@/core/nlp-config";
import type { Db } from "@/core/types";
import { nlpProviderKey, nlpTokens, readNlpApiKey } from "@/lib/nlp-models";
import { createTestDb, createTestUser } from "../helpers";

const TEST_KEY = randomBytes(32).toString("hex");

let db: Db;
let userId: number;

beforeEach(() => {
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
  db = createTestDb();
  userId = createTestUser(db, "nlpuser").id;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("nlpTokens", () => {
  it("stores NLP provider keys under the canonical parser field", () => {
    const tokens = nlpTokens("test-secret");

    expect(tokens).toEqual({ api_key: "test-secret" });
    expect("apiKey" in tokens).toBe(false);
  });

  it("reads legacy settings rows without writing legacy keys", () => {
    expect(readNlpApiKey({ apiKey: "legacy-secret" })).toBe("legacy-secret");
    expect(readNlpApiKey({ api_key: "current-secret" })).toBe("current-secret");
  });
});

describe("getActiveNlpConfig", () => {
  it("returns the enabled provider with its stored model", () => {
    upsertIntegrationConfig(
      db,
      userId,
      nlpProviderKey("anthropic"),
      nlpTokens("test-secret"),
      { model: "test-model" },
    );

    expect(getActiveNlpConfig(db, userId)).toEqual({
      provider: "anthropic",
      apiKey: "test-secret",
      model: "test-model",
    });
  });

  it("uses the shared model default when metadata omits the model", () => {
    upsertIntegrationConfig(
      db,
      userId,
      nlpProviderKey("openai"),
      nlpTokens("test-secret"),
    );

    expect(getActiveNlpConfig(db, userId)).toMatchObject({
      provider: "openai",
      apiKey: "test-secret",
      model: "gpt-4o-mini",
    });
  });

  it("ignores disabled providers", () => {
    upsertIntegrationConfig(
      db,
      userId,
      nlpProviderKey("anthropic"),
      nlpTokens("test-secret"),
    );
    setIntegrationEnabled(db, userId, nlpProviderKey("anthropic"), 0);

    expect(getActiveNlpConfig(db, userId)).toBeNull();
  });

  it("falls back to no LLM config when the enabled provider has no token", () => {
    upsertIntegrationConfig(db, userId, nlpProviderKey("anthropic"), {});

    expect(getActiveNlpConfig(db, userId)).toBeNull();
  });

  it("does not expose tokens through integration summaries", () => {
    upsertIntegrationConfig(
      db,
      userId,
      nlpProviderKey("anthropic"),
      nlpTokens("test-secret"),
    );

    const config = getIntegrationConfig(
      db,
      userId,
      nlpProviderKey("anthropic"),
    );
    const summaries = listIntegrationConfigs(db, userId);

    expect(config?.tokens).toEqual({ api_key: "test-secret" });
    expect("tokens" in summaries[0]).toBe(false);
    expect("encryptedTokens" in summaries[0]).toBe(false);
  });
});
