import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteIntegrationConfig,
  getIntegrationConfig,
  listIntegrationConfigs,
  upsertIntegrationConfig,
} from "@/core/integration-config";
import type { Db } from "@/core/types";
import { integrationConfigs } from "@/db/schema";
import { createTestDb, createTestUser } from "../helpers";

const TEST_KEY = randomBytes(32).toString("hex");

let db: Db;
let userId: number;

beforeEach(() => {
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
  db = createTestDb();
  const user = createTestUser(db, "testuser");
  userId = user.id;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("upsertIntegrationConfig", () => {
  it("creates a new config", () => {
    const tokens = { access_token: "tok_123", refresh_token: "ref_456" };
    const result = upsertIntegrationConfig(
      db,
      userId,
      "calendar_adapter",
      tokens,
    );

    expect(result.provider).toBe("calendar_adapter");
    expect(result.tokens).toEqual(tokens);
    expect(result.metadata).toBeNull();
    expect(result.enabled).toBe(1);
    expect(result.id).toBe(1);
  });

  it("creates a config with metadata", () => {
    const tokens = { access_token: "tok" };
    const metadata = { calendarId: "primary", syncInterval: 300 };
    const result = upsertIntegrationConfig(
      db,
      userId,
      "calendar_adapter",
      tokens,
      metadata,
    );

    expect(result.metadata).toEqual(metadata);
  });

  it("updates existing config on same provider", () => {
    upsertIntegrationConfig(db, userId, "github", {
      access_token: "old",
    });

    const updated = upsertIntegrationConfig(db, userId, "github", {
      access_token: "new",
    });

    expect(updated.tokens).toEqual({ access_token: "new" });

    const all = listIntegrationConfigs(db, userId);
    expect(all).toHaveLength(1);
  });

  it("stores different providers independently", () => {
    upsertIntegrationConfig(db, userId, "github", { token: "gh" });
    upsertIntegrationConfig(db, userId, "calendar_adapter", { token: "gc" });

    const all = listIntegrationConfigs(db, userId);
    expect(all).toHaveLength(2);
  });
});

describe("getIntegrationConfig", () => {
  it("returns null for nonexistent config", () => {
    expect(getIntegrationConfig(db, userId, "nonexistent")).toBeNull();
  });

  it("returns decrypted tokens", () => {
    const tokens = { access_token: "secret_value", scope: "read" };
    upsertIntegrationConfig(db, userId, "github", tokens);

    const config = getIntegrationConfig(db, userId, "github");
    expect(config).not.toBeNull();
    expect(config?.tokens).toEqual(tokens);
    expect(config?.provider).toBe("github");
  });

  it("does not return another user's config", () => {
    upsertIntegrationConfig(db, userId, "github", { token: "mine" });

    const other = createTestUser(db, "otheruser");
    expect(getIntegrationConfig(db, other.id, "github")).toBeNull();
  });
});

describe("deleteIntegrationConfig", () => {
  it("deletes existing config and returns true", () => {
    upsertIntegrationConfig(db, userId, "github", { token: "t" });

    const deleted = deleteIntegrationConfig(db, userId, "github");
    expect(deleted).toBe(true);
    expect(getIntegrationConfig(db, userId, "github")).toBeNull();
  });

  it("returns false for nonexistent config", () => {
    expect(deleteIntegrationConfig(db, userId, "nonexistent")).toBe(false);
  });
});

describe("listIntegrationConfigs", () => {
  it("returns empty array when no configs exist", () => {
    expect(listIntegrationConfigs(db, userId)).toEqual([]);
  });

  it("does not expose tokens", () => {
    upsertIntegrationConfig(db, userId, "github", {
      access_token: "secret",
    });

    const list = listIntegrationConfigs(db, userId);
    expect(list).toHaveLength(1);
    expect(list[0].provider).toBe("github");
    expect("tokens" in list[0]).toBe(false);
    expect("encryptedTokens" in list[0]).toBe(false);
  });

  it("returns parsed metadata", () => {
    const metadata = { calendarId: "primary" };
    upsertIntegrationConfig(
      db,
      userId,
      "calendar_adapter",
      { token: "t" },
      metadata,
    );

    const list = listIntegrationConfigs(db, userId);
    expect(list[0].metadata).toEqual(metadata);
  });
});

describe("encryption at rest", () => {
  it("stores encrypted tokens in the database, not plaintext", () => {
    const tokens = { access_token: "super_secret_token_value" };
    upsertIntegrationConfig(db, userId, "github", tokens);

    const raw = db
      .select()
      .from(integrationConfigs)
      .where(eq(integrationConfigs.userId, userId))
      .get();

    expect(raw).not.toBeNull();
    expect(raw?.encryptedTokens).not.toContain("super_secret_token_value");
    expect(raw?.encryptedTokens).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
  });
});
