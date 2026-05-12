import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findLocalUser,
  getOrCreateLocalUser,
  regenerateApiKey,
  validateApiKey,
} from "@/core/auth";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../helpers";

const state = vi.hoisted(() => ({
  db: undefined as unknown as Db,
}));

vi.mock("@/db", () => ({
  get db() {
    return state.db;
  },
}));

let db: Db;

beforeEach(() => {
  db = createTestDb();
  state.db = db;
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
    apiKey = user.apiKey;
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

  it("returns the owner record for API key validation", () => {
    const user = validateApiKey(db, apiKey);
    expect(user).toMatchObject({
      id: userId,
      username: "keyuser",
      apiKey,
    });
  });
});

describe("request auth helper", () => {
  it("uses the local owner when the request has no API key", async () => {
    const { getApiKeyUserOrLocalOwnerFromRequest } = await import(
      "@/lib/request-auth"
    );

    const user = await getApiKeyUserOrLocalOwnerFromRequest(
      new Request("http://delta.test/api/auth/me"),
    );

    expect(user?.id).toBe(findLocalUser(db)?.id);
  });

  it("validates x-api-key credentials", async () => {
    const existing = createTestUser(db, "request-key");
    const { getApiKeyUserOrLocalOwnerFromRequest } = await import(
      "@/lib/request-auth"
    );

    const user = await getApiKeyUserOrLocalOwnerFromRequest(
      new Request("http://delta.test/api/auth/me", {
        headers: { "x-api-key": existing.apiKey },
      }),
    );

    expect(user?.id).toBe(existing.id);
  });

  it("validates bearer credentials", async () => {
    const existing = createTestUser(db, "bearer-key");
    const { getApiKeyUserOrLocalOwnerFromRequest } = await import(
      "@/lib/request-auth"
    );

    const user = await getApiKeyUserOrLocalOwnerFromRequest(
      new Request("http://delta.test/api/auth/me", {
        headers: { Authorization: `Bearer ${existing.apiKey}` },
      }),
    );

    expect(user?.id).toBe(existing.id);
  });

  it("returns null for invalid API-key credentials", async () => {
    createTestUser(db, "request-key");
    const { getApiKeyUserOrLocalOwnerFromRequest } = await import(
      "@/lib/request-auth"
    );

    const user = await getApiKeyUserOrLocalOwnerFromRequest(
      new Request("http://delta.test/api/auth/me", {
        headers: { "x-api-key": "wrong-key" },
      }),
    );

    expect(user).toBeNull();
  });
});
