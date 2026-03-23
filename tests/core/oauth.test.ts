import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createUser } from "@/core/auth";
import {
  findAccountByProvider,
  findOrCreateUserFromOAuth,
  linkAccount,
  unlinkAccount,
} from "@/core/oauth";
import type { Db } from "@/core/types";
import { users } from "@/db/schema";
import { createTestDb } from "../helpers";

let db: Db;

beforeEach(() => {
  db = createTestDb();
});

describe("findOrCreateUserFromOAuth", () => {
  it("creates user on first login", () => {
    const user = findOrCreateUserFromOAuth(db, "github", "gh-123", {
      username: "barrett",
      email: "b@example.com",
    });

    expect(user.id).toBe(1);
    expect(user.username).toBe("barrett");
    expect("passwordHash" in user).toBe(false);

    const account = findAccountByProvider(db, "github", "gh-123");
    expect(account).not.toBeNull();
    expect(account?.userId).toBe(user.id);
  });

  it("returns existing user on subsequent login", () => {
    const first = findOrCreateUserFromOAuth(db, "github", "gh-123", {
      username: "barrett",
    });
    const second = findOrCreateUserFromOAuth(db, "github", "gh-123", {
      username: "barrett",
    });

    expect(second.id).toBe(first.id);
    expect(second.username).toBe(first.username);
  });

  it("deduplicates username with numeric suffix", () => {
    createUser(db, "barrett", "password123");

    const oauthUser = findOrCreateUserFromOAuth(db, "github", "gh-456", {
      username: "barrett",
    });

    expect(oauthUser.username).toBe("barrett1");
  });

  it("creates user without email", () => {
    const user = findOrCreateUserFromOAuth(db, "google", "g-789", {
      username: "someone",
    });

    expect(user.username).toBe("someone");
  });
});

describe("linkAccount", () => {
  it("links an OAuth provider to a user", () => {
    const user = createUser(db, "barrett", "password123");
    const account = linkAccount(db, user.id, "github", "gh-123");

    expect(account.provider).toBe("github");
    expect(account.providerAccountId).toBe("gh-123");
    expect(account.userId).toBe(user.id);

    const found = findAccountByProvider(db, "github", "gh-123");
    expect(found).not.toBeNull();
    expect(found?.userId).toBe(user.id);
  });

  it("allows multiple providers per user", () => {
    const user = createUser(db, "barrett", "password123");
    linkAccount(db, user.id, "github", "gh-123");
    linkAccount(db, user.id, "google", "g-456");

    const ghAccount = findAccountByProvider(db, "github", "gh-123");
    const gAccount = findAccountByProvider(db, "google", "g-456");

    expect(ghAccount?.userId).toBe(user.id);
    expect(gAccount?.userId).toBe(user.id);
  });

  it("rejects duplicate provider + providerAccountId", () => {
    const user1 = createUser(db, "user1", "password123");
    const user2 = createUser(db, "user2", "password456");

    linkAccount(db, user1.id, "github", "gh-123");
    expect(() => linkAccount(db, user2.id, "github", "gh-123")).toThrow();
  });
});

describe("unlinkAccount", () => {
  it("removes a linked provider", () => {
    const user = createUser(db, "barrett", "password123");
    linkAccount(db, user.id, "github", "gh-123");

    unlinkAccount(db, user.id, "github");

    const found = findAccountByProvider(db, "github", "gh-123");
    expect(found).toBeUndefined();
  });

  it("allows unlink when user has password", () => {
    const user = createUser(db, "barrett", "password123");
    linkAccount(db, user.id, "github", "gh-123");

    expect(() => unlinkAccount(db, user.id, "github")).not.toThrow();
  });

  it("allows unlink when user has other linked providers", () => {
    const user = findOrCreateUserFromOAuth(db, "github", "gh-123", {
      username: "barrett",
    });
    linkAccount(db, user.id, "google", "g-456");

    expect(() => unlinkAccount(db, user.id, "github")).not.toThrow();

    const found = findAccountByProvider(db, "github", "gh-123");
    expect(found).toBeUndefined();
  });

  it("throws when unlinking last auth method with no password", () => {
    const user = findOrCreateUserFromOAuth(db, "github", "gh-123", {
      username: "barrett",
    });

    const dbUser = db.select().from(users).where(eq(users.id, user.id)).get();
    expect(dbUser?.passwordHash).toBeNull();

    expect(() => unlinkAccount(db, user.id, "github")).toThrow(
      "Cannot unlink last auth method",
    );
  });
});
