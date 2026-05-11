import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteSystemConfig,
  getSystemConfig,
  setSystemConfig,
} from "@/core/system-config";
import type { Db } from "@/core/types";
import { systemConfigs } from "@/db/schema";
import { createTestDb } from "../helpers";

const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

let db: Db;

beforeEach(() => {
  db = createTestDb();
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
});

describe("getSystemConfig / setSystemConfig", () => {
  it("returns null for nonexistent key", () => {
    expect(getSystemConfig(db, "nonexistent")).toBeNull();
  });

  it("stores and retrieves a value", () => {
    setSystemConfig(db, "test.key", "test-value");
    expect(getSystemConfig(db, "test.key")).toBe("test-value");
  });

  it("updates an existing key", () => {
    setSystemConfig(db, "test.key", "first");
    setSystemConfig(db, "test.key", "second");
    expect(getSystemConfig(db, "test.key")).toBe("second");
  });

  it("stores values encrypted (not plaintext in DB)", () => {
    setSystemConfig(db, "secret", "my-secret-value");
    const row = db
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.key, "secret"))
      .get();
    expect(row).toBeTruthy();
    expect(row?.value).not.toBe("my-secret-value");
    expect(row?.value).toContain(":");
  });
});

describe("deleteSystemConfig", () => {
  it("returns false when key does not exist", () => {
    expect(deleteSystemConfig(db, "nonexistent")).toBe(false);
  });

  it("deletes an existing key and returns true", () => {
    setSystemConfig(db, "to-delete", "value");
    expect(deleteSystemConfig(db, "to-delete")).toBe(true);
    expect(getSystemConfig(db, "to-delete")).toBeNull();
  });
});
