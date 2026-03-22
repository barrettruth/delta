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

describe("createUser", () => {
  it("creates a user with hashed password and API key", () => {
    const user = createUser(db, "barrett", "password123");
    expect(user.id).toBe(1);
    expect(user.username).toBe("barrett");
    expect(user.apiKey).toBeTruthy();
    expect(user.createdAt).toBeTruthy();
    expect("passwordHash" in user).toBe(false);
  });

  it("rejects duplicate username", () => {
    createUser(db, "barrett", "password123");
    expect(() => createUser(db, "barrett", "other")).toThrow(
      "Username already taken",
    );
  });
});

describe("verifyPassword", () => {
  beforeEach(() => {
    createUser(db, "barrett", "password123");
  });

  it("returns user for correct password", () => {
    const user = verifyPassword(db, "barrett", "password123");
    expect(user).not.toBeNull();
    expect(user?.username).toBe("barrett");
  });

  it("returns null for wrong password", () => {
    expect(verifyPassword(db, "barrett", "wrong")).toBeNull();
  });

  it("returns null for nonexistent user", () => {
    expect(verifyPassword(db, "nobody", "password123")).toBeNull();
  });
});

describe("sessions", () => {
  let userId: number;

  beforeEach(() => {
    const user = createUser(db, "barrett", "password123");
    userId = user.id;
  });

  it("creates and validates a session", () => {
    const sessionId = createSession(db, userId);
    expect(sessionId).toBeTruthy();

    const user = validateSession(db, sessionId);
    expect(user).not.toBeNull();
    expect(user?.username).toBe("barrett");
  });

  it("returns null for invalid session", () => {
    expect(validateSession(db, "nonexistent")).toBeNull();
  });

  it("deletes a session", () => {
    const sessionId = createSession(db, userId);
    deleteSession(db, sessionId);
    expect(validateSession(db, sessionId)).toBeNull();
  });
});

describe("API key auth", () => {
  let apiKey: string;

  beforeEach(() => {
    const user = createUser(db, "barrett", "password123");
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
