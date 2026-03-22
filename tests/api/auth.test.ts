import { beforeEach, describe, expect, it } from "vitest";
import {
  createSession,
  createUser,
  deleteSession,
  regenerateApiKey,
  validateApiKey,
  validateSession,
  verifyPassword,
} from "@/core/auth";
import type { Db } from "@/core/types";
import { createTestDb } from "../helpers";

let db: Db;

beforeEach(() => {
  db = createTestDb();
});

describe("full auth flow", () => {
  it("create user, verify password, create session, validate, delete", () => {
    const user = createUser(db, "testuser", "s3cure-p4ss!");
    expect(user.id).toBe(1);
    expect(user.username).toBe("testuser");
    expect(user.apiKey).toBeTruthy();
    expect("passwordHash" in user).toBe(false);

    const verified = verifyPassword(db, "testuser", "s3cure-p4ss!");
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(user.id);

    const sessionId = createSession(db, user.id);
    expect(typeof sessionId).toBe("string");
    expect(sessionId.length).toBeGreaterThan(0);

    const sessionUser = validateSession(db, sessionId);
    expect(sessionUser).not.toBeNull();
    expect(sessionUser?.username).toBe("testuser");
    expect("passwordHash" in (sessionUser ?? {})).toBe(false);

    deleteSession(db, sessionId);
    expect(validateSession(db, sessionId)).toBeNull();
  });
});

describe("user creation edge cases", () => {
  it("rejects duplicate usernames", () => {
    createUser(db, "alice", "password1");
    expect(() => createUser(db, "alice", "password2")).toThrow(
      "Username already taken",
    );
  });

  it("creates multiple distinct users", () => {
    const u1 = createUser(db, "alice", "pass1");
    const u2 = createUser(db, "bob", "pass2");
    expect(u1.id).not.toBe(u2.id);
    expect(u1.apiKey).not.toBe(u2.apiKey);
  });

  it("does not expose password hash in returned user", () => {
    const user = createUser(db, "secure", "mypassword");
    expect(Object.keys(user)).not.toContain("passwordHash");
  });
});

describe("password verification", () => {
  beforeEach(() => {
    createUser(db, "testuser", "correct-password");
  });

  it("succeeds with correct password", () => {
    const user = verifyPassword(db, "testuser", "correct-password");
    expect(user).not.toBeNull();
    expect(user?.username).toBe("testuser");
  });

  it("fails with wrong password", () => {
    expect(verifyPassword(db, "testuser", "wrong-password")).toBeNull();
  });

  it("fails with nonexistent username", () => {
    expect(verifyPassword(db, "ghost", "correct-password")).toBeNull();
  });

  it("does not expose password hash on successful verification", () => {
    const user = verifyPassword(db, "testuser", "correct-password");
    expect(Object.keys(user ?? {})).not.toContain("passwordHash");
  });
});

describe("session management", () => {
  let userId: number;

  beforeEach(() => {
    const user = createUser(db, "sessionuser", "password");
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
    const user = createUser(db, "keyuser", "password");
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
