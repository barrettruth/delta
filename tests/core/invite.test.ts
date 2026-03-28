import { beforeEach, describe, expect, it } from "vitest";
import {
  consumeInviteCode,
  generateInviteCode,
  validateInviteCode,
} from "@/core/auth";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../helpers";

let db: Db;

beforeEach(() => {
  db = createTestDb();
});

describe("generateInviteCode", () => {
  it("produces code matching delta- plus 8 alphanumeric chars", () => {
    const user = createTestUser(db, "barrett");
    const code = generateInviteCode(db, user.id);
    expect(code).toMatch(/^delta-[a-z0-9]{8}$/);
  });

  it("generates unique codes", () => {
    const user = createTestUser(db, "barrett");
    const codes = new Set<string>();
    for (let i = 0; i < 20; i++) {
      codes.add(generateInviteCode(db, user.id));
    }
    expect(codes.size).toBe(20);
  });
});

describe("validateInviteCode", () => {
  it("returns row for unused code", () => {
    const user = createTestUser(db, "barrett");
    const code = generateInviteCode(db, user.id);
    const row = validateInviteCode(db, code);
    expect(row).not.toBeNull();
    expect(row?.code).toBe(code);
    expect(row?.createdBy).toBe(user.id);
    expect(row?.usedBy).toBeNull();
  });

  it("returns null for nonexistent code", () => {
    expect(validateInviteCode(db, "delta-nonexist")).toBeNull();
  });

  it("returns null for used code", () => {
    const creator = createTestUser(db, "barrett");
    const consumer = createTestUser(db, "other");
    const code = generateInviteCode(db, creator.id);
    consumeInviteCode(db, code, consumer.id);
    expect(validateInviteCode(db, code)).toBeNull();
  });
});

describe("consumeInviteCode", () => {
  it("marks code as used", () => {
    const creator = createTestUser(db, "barrett");
    const consumer = createTestUser(db, "other");
    const code = generateInviteCode(db, creator.id);

    const result = consumeInviteCode(db, code, consumer.id);
    expect(result).toBe(true);

    const row = validateInviteCode(db, code);
    expect(row).toBeNull();
  });

  it("prevents double consumption", () => {
    const creator = createTestUser(db, "barrett");
    const consumer1 = createTestUser(db, "user1");
    const consumer2 = createTestUser(db, "user2");
    const code = generateInviteCode(db, creator.id);

    expect(consumeInviteCode(db, code, consumer1.id)).toBe(true);
    expect(consumeInviteCode(db, code, consumer2.id)).toBe(false);
  });

  it("returns false for nonexistent code", () => {
    const user = createTestUser(db, "barrett");
    expect(consumeInviteCode(db, "delta-nonexist", user.id)).toBe(false);
  });
});
