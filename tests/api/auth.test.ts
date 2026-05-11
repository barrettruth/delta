import { beforeEach, describe, expect, it } from "vitest";
import {
  findLocalUser,
  getOrCreateLocalUser,
  regenerateApiKey,
  validateApiKey,
} from "@/core/auth";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../helpers";

let db: Db;

beforeEach(() => {
  db = createTestDb();
});

describe("local self-hosted user", () => {
  it("creates a local user with an API key", () => {
    const user = getOrCreateLocalUser(db);
    expect(user.id).toBeGreaterThan(0);
    expect(user.apiKey).toBeTruthy();
  });

  it("finds the existing local user", () => {
    const existing = createTestUser(db, "local");
    expect(findLocalUser(db)?.id).toBe(existing.id);
  });
});

describe("API key management", () => {
  let apiKey: string;
  let userId: number;

  beforeEach(() => {
    const user = createTestUser(db, "keyuser");
    apiKey = user.apiKey as string;
    userId = user.id;
  });

  it("validates correct API key", () => {
    const user = validateApiKey(db, apiKey);
    expect(user).not.toBeNull();
    expect(user?.username).toBe("keyuser");
  });

  it("rejects invalid API key", () => {
    expect(validateApiKey(db, "completely-wrong-key")).toBeNull();
  });

  it("regenerates API key and invalidates old one", () => {
    const newKey = regenerateApiKey(db, userId);
    expect(newKey).not.toBe(apiKey);
    expect(typeof newKey).toBe("string");
    expect(newKey.length).toBeGreaterThan(0);

    expect(validateApiKey(db, apiKey)).toBeNull();
    expect(validateApiKey(db, newKey)).not.toBeNull();
  });

  it("multiple regenerations each invalidate the previous key", () => {
    const key2 = regenerateApiKey(db, userId);
    const key3 = regenerateApiKey(db, userId);

    expect(validateApiKey(db, apiKey)).toBeNull();
    expect(validateApiKey(db, key2)).toBeNull();
    expect(validateApiKey(db, key3)).not.toBeNull();
  });

  it("does not expose password hash via API key validation", () => {
    const user = validateApiKey(db, apiKey);
    expect(Object.keys(user ?? {})).not.toContain("passwordHash");
  });
});
