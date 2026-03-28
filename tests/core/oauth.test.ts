import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthorizationUrl,
  findAccountByProvider,
  findOrCreateUserFromOAuth,
  getEnabledProviders,
  getLinkedAccounts,
  getProviderConfig,
  linkAccount,
} from "@/core/oauth";
import type { Db } from "@/core/types";
import { users } from "@/db/schema";
import { createTestDb } from "../helpers";

let db: Db;

beforeEach(() => {
  db = createTestDb();
  vi.unstubAllEnvs();
});

describe("getProviderConfig", () => {
  it("returns null when GitHub env vars are missing", () => {
    vi.stubEnv("OAUTH_GITHUB_CLIENT_ID", "");
    vi.stubEnv("OAUTH_GITHUB_CLIENT_SECRET", "");
    expect(getProviderConfig("github")).toBeNull();
  });

  it("returns null when only CLIENT_ID is set for GitHub", () => {
    vi.stubEnv("OAUTH_GITHUB_CLIENT_ID", "id");
    vi.stubEnv("OAUTH_GITHUB_CLIENT_SECRET", "");
    expect(getProviderConfig("github")).toBeNull();
  });

  it("returns config when GitHub env vars are set", () => {
    vi.stubEnv("OAUTH_GITHUB_CLIENT_ID", "gh-id");
    vi.stubEnv("OAUTH_GITHUB_CLIENT_SECRET", "gh-secret");
    const config = getProviderConfig("github");
    expect(config).not.toBeNull();
    expect(config?.clientId).toBe("gh-id");
    expect(config?.clientSecret).toBe("gh-secret");
    expect(config?.authorizeUrl).toContain("github.com");
    expect(config?.scopes).toContain("read:user");
  });

  it("returns null when Google env vars are missing", () => {
    vi.stubEnv("OAUTH_GOOGLE_CLIENT_ID", "");
    vi.stubEnv("OAUTH_GOOGLE_CLIENT_SECRET", "");
    expect(getProviderConfig("google")).toBeNull();
  });

  it("returns config when Google env vars are set", () => {
    vi.stubEnv("OAUTH_GOOGLE_CLIENT_ID", "g-id");
    vi.stubEnv("OAUTH_GOOGLE_CLIENT_SECRET", "g-secret");
    const config = getProviderConfig("google");
    expect(config).not.toBeNull();
    expect(config?.clientId).toBe("g-id");
    expect(config?.scopes).toContain("openid");
  });
});

describe("getEnabledProviders", () => {
  it("returns empty array when no env vars set", () => {
    vi.stubEnv("OAUTH_GITHUB_CLIENT_ID", "");
    vi.stubEnv("OAUTH_GOOGLE_CLIENT_ID", "");
    expect(getEnabledProviders()).toEqual([]);
  });

  it("returns only github when only GitHub CLIENT_ID is set", () => {
    vi.stubEnv("OAUTH_GITHUB_CLIENT_ID", "gh-id");
    vi.stubEnv("OAUTH_GOOGLE_CLIENT_ID", "");
    expect(getEnabledProviders()).toEqual(["github"]);
  });

  it("returns only google when only Google CLIENT_ID is set", () => {
    vi.stubEnv("OAUTH_GITHUB_CLIENT_ID", "");
    vi.stubEnv("OAUTH_GOOGLE_CLIENT_ID", "g-id");
    expect(getEnabledProviders()).toEqual(["google"]);
  });

  it("returns both when both are set", () => {
    vi.stubEnv("OAUTH_GITHUB_CLIENT_ID", "gh-id");
    vi.stubEnv("OAUTH_GOOGLE_CLIENT_ID", "g-id");
    expect(getEnabledProviders()).toEqual(["github", "google"]);
  });
});

describe("buildAuthorizationUrl", () => {
  beforeEach(() => {
    vi.stubEnv("OAUTH_GITHUB_CLIENT_ID", "gh-id");
    vi.stubEnv("OAUTH_GITHUB_CLIENT_SECRET", "gh-secret");
    vi.stubEnv("OAUTH_GOOGLE_CLIENT_ID", "g-id");
    vi.stubEnv("OAUTH_GOOGLE_CLIENT_SECRET", "g-secret");
  });

  it("builds correct GitHub authorization URL", () => {
    const url = buildAuthorizationUrl(
      "github",
      "test-state",
      "http://localhost:3000/api/auth/callback/github",
    );
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://github.com");
    expect(parsed.pathname).toBe("/login/oauth/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("gh-id");
    expect(parsed.searchParams.get("state")).toBe("test-state");
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/auth/callback/github",
    );
    expect(parsed.searchParams.get("scope")).toContain("read:user");
    expect(parsed.searchParams.get("response_type")).toBe("code");
  });

  it("builds correct Google authorization URL with offline access", () => {
    const url = buildAuthorizationUrl(
      "google",
      "test-state",
      "http://localhost:3000/api/auth/callback/google",
    );
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://accounts.google.com");
    expect(parsed.searchParams.get("access_type")).toBe("offline");
    expect(parsed.searchParams.get("prompt")).toBe("consent");
    expect(parsed.searchParams.get("scope")).toContain("openid");
  });

  it("throws when provider is not configured", () => {
    vi.stubEnv("OAUTH_GITHUB_CLIENT_ID", "");
    vi.stubEnv("OAUTH_GITHUB_CLIENT_SECRET", "");
    expect(() =>
      buildAuthorizationUrl("github", "state", "http://localhost:3000/cb"),
    ).toThrow("not configured");
  });
});

describe("linkAccount", () => {
  it("inserts an account record", () => {
    const user = db
      .insert(users)
      .values({
        username: "testuser",
        passwordHash: "hash",
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();

    const account = linkAccount(db, user.id, "github", "gh-12345", {
      accessToken: "tok",
    });

    expect(account.provider).toBe("github");
    expect(account.providerAccountId).toBe("gh-12345");
    expect(account.userId).toBe(user.id);
    expect(account.accessToken).toBe("tok");
  });

  it("stores token expiry from expiresIn", () => {
    const user = db
      .insert(users)
      .values({
        username: "testuser",
        passwordHash: null,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();

    const account = linkAccount(db, user.id, "google", "g-123", {
      accessToken: "tok",
      refreshToken: "rtok",
      expiresIn: 3600,
    });

    expect(account.refreshToken).toBe("rtok");
    expect(account.tokenExpiresAt).toBeTruthy();
  });

  it("stores email when provided", () => {
    const user = db
      .insert(users)
      .values({
        username: "testuser",
        passwordHash: null,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();

    const account = linkAccount(
      db,
      user.id,
      "github",
      "gh-456",
      { accessToken: "tok" },
      "user@example.com",
    );

    expect(account.email).toBe("user@example.com");
  });
});

describe("findAccountByProvider", () => {
  it("returns null when no account exists", () => {
    expect(findAccountByProvider(db, "github", "nonexistent")).toBeNull();
  });

  it("finds an existing account and joins with user", () => {
    const user = db
      .insert(users)
      .values({
        username: "testuser",
        passwordHash: null,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();

    linkAccount(db, user.id, "github", "gh-789", { accessToken: "tok" });

    const result = findAccountByProvider(db, "github", "gh-789");
    expect(result).not.toBeNull();
    expect(result?.users.id).toBe(user.id);
    expect(result?.accounts.provider).toBe("github");
  });
});

describe("findOrCreateUserFromOAuth", () => {
  it("creates a new user when no existing account or user match", () => {
    const { user, isNew } = findOrCreateUserFromOAuth(
      db,
      "github",
      { id: "gh-1", email: "new@example.com", name: "New User" },
      { accessToken: "tok" },
    );

    expect(isNew).toBe(true);
    expect(user.username).toBe("New User");
    expect(user.passwordHash).toBeNull();

    const linked = getLinkedAccounts(db, user.id);
    expect(linked).toHaveLength(1);
    expect(linked[0].provider).toBe("github");
  });

  it("returns existing user when account already linked", () => {
    const first = findOrCreateUserFromOAuth(
      db,
      "github",
      { id: "gh-2", email: "existing@example.com", name: "Existing" },
      { accessToken: "tok1" },
    );

    const second = findOrCreateUserFromOAuth(
      db,
      "github",
      { id: "gh-2", email: "existing@example.com", name: "Existing" },
      { accessToken: "tok2" },
    );

    expect(second.isNew).toBe(false);
    expect(second.user.id).toBe(first.user.id);
  });

  it("links to existing user when username matches provider email", () => {
    const existingUser = db
      .insert(users)
      .values({
        username: "match@example.com",
        passwordHash: "hash",
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();

    const { user, isNew } = findOrCreateUserFromOAuth(
      db,
      "google",
      { id: "g-1", email: "match@example.com", name: "Match User" },
      { accessToken: "tok" },
    );

    expect(isNew).toBe(false);
    expect(user.id).toBe(existingUser.id);
  });

  it("appends random suffix when username is taken", () => {
    db.insert(users)
      .values({
        username: "Taken Name",
        passwordHash: "hash",
        createdAt: new Date().toISOString(),
      })
      .run();

    const { user, isNew } = findOrCreateUserFromOAuth(
      db,
      "github",
      { id: "gh-taken", email: "taken@example.com", name: "Taken Name" },
      { accessToken: "tok" },
    );

    expect(isNew).toBe(true);
    expect(user.username).toMatch(/^Taken Name-[a-f0-9]{8}$/);
  });

  it("uses provider name as fallback username", () => {
    const { user, isNew } = findOrCreateUserFromOAuth(
      db,
      "github",
      { id: "gh-noname", email: "" },
      { accessToken: "tok" },
    );

    expect(isNew).toBe(true);
    expect(user.username).toBe("github");
  });
});

describe("getLinkedAccounts", () => {
  it("returns empty array when user has no linked accounts", () => {
    const user = db
      .insert(users)
      .values({
        username: "lonely",
        passwordHash: null,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();

    expect(getLinkedAccounts(db, user.id)).toEqual([]);
  });

  it("returns all linked accounts without tokens", () => {
    const user = db
      .insert(users)
      .values({
        username: "multi",
        passwordHash: null,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();

    linkAccount(db, user.id, "github", "gh-multi", {
      accessToken: "secret-tok",
    });
    linkAccount(db, user.id, "google", "g-multi", {
      accessToken: "secret-tok2",
      refreshToken: "secret-refresh",
    });

    const linked = getLinkedAccounts(db, user.id);
    expect(linked).toHaveLength(2);

    for (const acct of linked) {
      expect(acct).not.toHaveProperty("accessToken");
      expect(acct).not.toHaveProperty("refreshToken");
      expect(acct).toHaveProperty("provider");
      expect(acct).toHaveProperty("providerAccountId");
      expect(acct).toHaveProperty("email");
      expect(acct).toHaveProperty("createdAt");
    }
  });
});

describe("duplicate account prevention", () => {
  it("throws on duplicate (provider, providerAccountId)", () => {
    const user = db
      .insert(users)
      .values({
        username: "duptest",
        passwordHash: null,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();

    linkAccount(db, user.id, "github", "gh-dup", { accessToken: "tok1" });

    expect(() =>
      linkAccount(db, user.id, "github", "gh-dup", { accessToken: "tok2" }),
    ).toThrow();
  });

  it("allows same providerAccountId for different providers", () => {
    const user = db
      .insert(users)
      .values({
        username: "crosstest",
        passwordHash: null,
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get();

    linkAccount(db, user.id, "github", "shared-id", { accessToken: "tok1" });
    linkAccount(db, user.id, "google", "shared-id", { accessToken: "tok2" });

    const linked = getLinkedAccounts(db, user.id);
    expect(linked).toHaveLength(2);
  });
});
