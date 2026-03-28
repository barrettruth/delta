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

describe("sessions", () => {
  let userId: number;

  beforeEach(() => {
    const user = createTestUser(db, "barrett");
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
