import { beforeEach, describe, expect, it } from "vitest";
import {
  createSession,
  deleteSession,
  regenerateApiKey,
  validateApiKey,
  validateSession,
} from "@/core/auth";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../helpers";

let db: Db;

beforeEach(() => {
  db = createTestDb();
});

describe("session management", () => {
  let userId: number;

  beforeEach(() => {
    const user = createTestUser(db, "sessionuser");
    userId = user.id;
  });

  it("creates unique session IDs", () => {
    const s1 = createSession(db, userId);
    const s2 = createSession(db, userId);
    expect(s1).not.toBe(s2);
  });

  it("validates active session", () => {
    const sessionId = createSession(db, userId);
    const user = validateSession(db, sessionId);
    expect(user).not.toBeNull();
    expect(user?.id).toBe(userId);
  });

  it("returns null for nonexistent session", () => {
    expect(validateSession(db, "fake-session-id-12345")).toBeNull();
  });

  it("returns null after session deletion", () => {
    const sessionId = createSession(db, userId);
    deleteSession(db, sessionId);
    expect(validateSession(db, sessionId)).toBeNull();
  });

  it("deleting one session does not affect others", () => {
    const s1 = createSession(db, userId);
    const s2 = createSession(db, userId);

    deleteSession(db, s1);

    expect(validateSession(db, s1)).toBeNull();
    expect(validateSession(db, s2)).not.toBeNull();
  });

  it("deleting nonexistent session is a no-op", () => {
    expect(() => deleteSession(db, "nonexistent")).not.toThrow();
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
