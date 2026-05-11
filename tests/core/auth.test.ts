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
  it("creates a local user when none exists", () => {
    const user = getOrCreateLocalUser(db);
    expect(user.username).toBe("delta");
    expect(user.apiKey).toBeTruthy();
  });

  it("reuses the first local user", () => {
    const existing = createTestUser(db, "barrett");
    const user = getOrCreateLocalUser(db);
    expect(user.id).toBe(existing.id);
    expect(user.username).toBe("barrett");
  });

  it("returns null when no local user exists", () => {
    expect(findLocalUser(db)).toBeNull();
  });
});

describe("API key auth", () => {
  let apiKey: string;

  beforeEach(() => {
    const user = createTestUser(db, "barrett");
    apiKey = user.apiKey as string;
  });

  it("validates correct API key", () => {
    const user = validateApiKey(db, apiKey);
    expect(user).not.toBeNull();
    expect(user?.username).toBe("barrett");
  });

  it("returns null for invalid API key", () => {
    expect(validateApiKey(db, "bad-key")).toBeNull();
  });

  it("regenerates API key", () => {
    const newKey = regenerateApiKey(db, 1);
    expect(newKey).not.toBe(apiKey);

    expect(validateApiKey(db, apiKey)).toBeNull();
    expect(validateApiKey(db, newKey)).not.toBeNull();
  });
});
