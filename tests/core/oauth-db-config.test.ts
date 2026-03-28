import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEnabledProviders, getProviderConfig } from "@/core/oauth";
import { setOAuthProviderConfig } from "@/core/system-config";
import type { Db } from "@/core/types";
import { createTestDb } from "../helpers";

const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

let db: Db;

beforeEach(() => {
  db = createTestDb();
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
  vi.stubEnv("OAUTH_GITHUB_CLIENT_ID", "");
  vi.stubEnv("OAUTH_GITHUB_CLIENT_SECRET", "");
  vi.stubEnv("OAUTH_GOOGLE_CLIENT_ID", "");
  vi.stubEnv("OAUTH_GOOGLE_CLIENT_SECRET", "");
});

describe("getProviderConfig with DB config", () => {
  it("uses DB config when env vars are empty", () => {
    setOAuthProviderConfig(db, "github", "db-gh-id", "db-gh-secret");
    const config = getProviderConfig(db, "github");
    expect(config).not.toBeNull();
    expect(config?.clientId).toBe("db-gh-id");
    expect(config?.clientSecret).toBe("db-gh-secret");
    expect(config?.authorizeUrl).toContain("github.com");
  });

  it("prefers DB config over env vars", () => {
    vi.stubEnv("OAUTH_GITHUB_CLIENT_ID", "env-id");
    vi.stubEnv("OAUTH_GITHUB_CLIENT_SECRET", "env-secret");
    setOAuthProviderConfig(db, "github", "db-id", "db-secret");
    const config = getProviderConfig(db, "github");
    expect(config?.clientId).toBe("db-id");
    expect(config?.clientSecret).toBe("db-secret");
  });

  it("falls back to env vars when DB has no config", () => {
    vi.stubEnv("OAUTH_GOOGLE_CLIENT_ID", "env-g-id");
    vi.stubEnv("OAUTH_GOOGLE_CLIENT_SECRET", "env-g-secret");
    const config = getProviderConfig(db, "google");
    expect(config?.clientId).toBe("env-g-id");
    expect(config?.clientSecret).toBe("env-g-secret");
  });
});

describe("getEnabledProviders with DB config", () => {
  it("includes providers configured in DB", () => {
    setOAuthProviderConfig(db, "github", "db-id", "db-secret");
    const enabled = getEnabledProviders(db);
    expect(enabled).toContain("github");
    expect(enabled).not.toContain("google");
  });

  it("includes providers from both DB and env", () => {
    setOAuthProviderConfig(db, "github", "db-id", "db-secret");
    vi.stubEnv("OAUTH_GOOGLE_CLIENT_ID", "env-g-id");
    vi.stubEnv("OAUTH_GOOGLE_CLIENT_SECRET", "env-g-secret");
    const enabled = getEnabledProviders(db);
    expect(enabled).toContain("github");
    expect(enabled).toContain("google");
  });
});
