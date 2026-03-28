import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteOAuthProviderConfig,
  deleteSystemConfig,
  getOAuthProviderConfig,
  getSystemConfig,
  isOAuthProviderConfigured,
  setOAuthProviderConfig,
  setSystemConfig,
} from "@/core/system-config";
import type { Db } from "@/core/types";
import { systemConfigs } from "@/db/schema";
import { createTestDb } from "../helpers";

const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

let db: Db;

beforeEach(() => {
  db = createTestDb();
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
});

describe("getSystemConfig / setSystemConfig", () => {
  it("returns null for nonexistent key", () => {
    expect(getSystemConfig(db, "nonexistent")).toBeNull();
  });

  it("stores and retrieves a value", () => {
    setSystemConfig(db, "test.key", "test-value");
    expect(getSystemConfig(db, "test.key")).toBe("test-value");
  });

  it("updates an existing key", () => {
    setSystemConfig(db, "test.key", "first");
    setSystemConfig(db, "test.key", "second");
    expect(getSystemConfig(db, "test.key")).toBe("second");
  });

  it("stores values encrypted (not plaintext in DB)", () => {
    setSystemConfig(db, "secret", "my-secret-value");
    const row = db
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.key, "secret"))
      .get();
    expect(row).toBeTruthy();
    expect(row?.value).not.toBe("my-secret-value");
    expect(row?.value).toContain(":");
  });
});

describe("deleteSystemConfig", () => {
  it("returns false when key does not exist", () => {
    expect(deleteSystemConfig(db, "nonexistent")).toBe(false);
  });

  it("deletes an existing key and returns true", () => {
    setSystemConfig(db, "to-delete", "value");
    expect(deleteSystemConfig(db, "to-delete")).toBe(true);
    expect(getSystemConfig(db, "to-delete")).toBeNull();
  });
});

describe("getOAuthProviderConfig", () => {
  it("returns null when no config exists", () => {
    expect(getOAuthProviderConfig(db, "github")).toBeNull();
  });

  it("returns null when only client_id is set", () => {
    setSystemConfig(db, "oauth.github.client_id", "my-id");
    expect(getOAuthProviderConfig(db, "github")).toBeNull();
  });

  it("returns config when both client_id and client_secret are set", () => {
    setSystemConfig(db, "oauth.github.client_id", "my-id");
    setSystemConfig(db, "oauth.github.client_secret", "my-secret");
    const config = getOAuthProviderConfig(db, "github");
    expect(config).toEqual({ clientId: "my-id", clientSecret: "my-secret" });
  });
});

describe("setOAuthProviderConfig", () => {
  it("stores both client_id and client_secret", () => {
    setOAuthProviderConfig(db, "google", "g-id", "g-secret");
    const config = getOAuthProviderConfig(db, "google");
    expect(config).toEqual({ clientId: "g-id", clientSecret: "g-secret" });
  });
});

describe("deleteOAuthProviderConfig", () => {
  it("returns false when provider not configured", () => {
    expect(deleteOAuthProviderConfig(db, "github")).toBe(false);
  });

  it("removes both keys", () => {
    setOAuthProviderConfig(db, "github", "id", "secret");
    expect(deleteOAuthProviderConfig(db, "github")).toBe(true);
    expect(getOAuthProviderConfig(db, "github")).toBeNull();
  });
});

describe("isOAuthProviderConfigured", () => {
  it("returns false when not configured", () => {
    expect(isOAuthProviderConfigured(db, "github")).toBe(false);
  });

  it("returns true when configured", () => {
    setOAuthProviderConfig(db, "github", "id", "secret");
    expect(isOAuthProviderConfigured(db, "github")).toBe(true);
  });
});
