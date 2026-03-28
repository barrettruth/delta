import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  consumeInviteToken,
  generateInviteLink,
  listInviteLinks,
  validateInviteToken,
} from "@/core/auth";
import type { Db } from "@/core/types";
import { inviteLinks } from "@/db/schema";
import { createTestDb, createTestUser } from "../helpers";

let db: Db;

beforeEach(() => {
  db = createTestDb();
});

describe("generateInviteLink", () => {
  it("produces a base64url token", () => {
    const user = createTestUser(db, "barrett");
    const token = generateInviteLink(db, user.id);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("generates unique tokens", () => {
    const user = createTestUser(db, "barrett");
    const tokens = new Set<string>();
    for (let i = 0; i < 20; i++) {
      tokens.add(generateInviteLink(db, user.id));
    }
    expect(tokens.size).toBe(20);
  });

  it("stores invite with correct defaults", () => {
    const user = createTestUser(db, "barrett");
    const token = generateInviteLink(db, user.id);
    const row = db
      .select()
      .from(inviteLinks)
      .where(eq(inviteLinks.token, token))
      .get();
    expect(row).toBeDefined();
    expect(row?.maxUses).toBe(1);
    expect(row?.useCount).toBe(0);
    expect(row?.createdBy).toBe(user.id);
  });

  it("respects custom maxUses", () => {
    const user = createTestUser(db, "barrett");
    const token = generateInviteLink(db, user.id, 5);
    const row = db
      .select()
      .from(inviteLinks)
      .where(eq(inviteLinks.token, token))
      .get();
    expect(row?.maxUses).toBe(5);
  });
});

describe("validateInviteToken", () => {
  it("returns row for valid token", () => {
    const user = createTestUser(db, "barrett");
    const token = generateInviteLink(db, user.id);
    const row = validateInviteToken(db, token);
    expect(row).not.toBeNull();
    expect(row?.token).toBe(token);
    expect(row?.createdBy).toBe(user.id);
  });

  it("returns null for nonexistent token", () => {
    expect(validateInviteToken(db, "nonexistent")).toBeNull();
  });

  it("returns null for expired token", () => {
    const user = createTestUser(db, "barrett");
    const token = generateInviteLink(db, user.id);
    db.update(inviteLinks)
      .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(inviteLinks.token, token))
      .run();
    expect(validateInviteToken(db, token)).toBeNull();
  });

  it("returns null for fully used token", () => {
    const user = createTestUser(db, "barrett");
    const consumer = createTestUser(db, "other");
    const token = generateInviteLink(db, user.id, 1);
    consumeInviteToken(db, token, consumer.id);
    expect(validateInviteToken(db, token)).toBeNull();
  });
});

describe("consumeInviteToken", () => {
  it("marks token as used", () => {
    const creator = createTestUser(db, "barrett");
    const consumer = createTestUser(db, "other");
    const token = generateInviteLink(db, creator.id);

    const result = consumeInviteToken(db, token, consumer.id);
    expect(result).toBe(true);

    const row = db
      .select()
      .from(inviteLinks)
      .where(eq(inviteLinks.token, token))
      .get();
    expect(row?.useCount).toBe(1);
    expect(row?.usedBy).toBe(consumer.id);
    expect(row?.usedAt).toBeTruthy();
  });

  it("prevents consumption beyond maxUses", () => {
    const creator = createTestUser(db, "barrett");
    const consumer1 = createTestUser(db, "user1");
    const consumer2 = createTestUser(db, "user2");
    const token = generateInviteLink(db, creator.id, 1);

    expect(consumeInviteToken(db, token, consumer1.id)).toBe(true);
    expect(consumeInviteToken(db, token, consumer2.id)).toBe(false);
  });

  it("allows multiple uses for multi-use tokens", () => {
    const creator = createTestUser(db, "barrett");
    const consumer1 = createTestUser(db, "user1");
    const consumer2 = createTestUser(db, "user2");
    const token = generateInviteLink(db, creator.id, 3);

    expect(consumeInviteToken(db, token, consumer1.id)).toBe(true);
    expect(consumeInviteToken(db, token, consumer2.id)).toBe(true);

    const row = db
      .select()
      .from(inviteLinks)
      .where(eq(inviteLinks.token, token))
      .get();
    expect(row?.useCount).toBe(2);
  });

  it("returns false for nonexistent token", () => {
    const user = createTestUser(db, "barrett");
    expect(consumeInviteToken(db, "nonexistent", user.id)).toBe(false);
  });

  it("returns false for expired token", () => {
    const creator = createTestUser(db, "barrett");
    const consumer = createTestUser(db, "other");
    const token = generateInviteLink(db, creator.id);
    db.update(inviteLinks)
      .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(inviteLinks.token, token))
      .run();
    expect(consumeInviteToken(db, token, consumer.id)).toBe(false);
  });
});

describe("listInviteLinks", () => {
  it("returns invites for the user", () => {
    const user = createTestUser(db, "barrett");
    generateInviteLink(db, user.id);
    generateInviteLink(db, user.id);

    const links = listInviteLinks(db, user.id);
    expect(links).toHaveLength(2);
  });

  it("does not return other users invites", () => {
    const user1 = createTestUser(db, "barrett");
    const user2 = createTestUser(db, "other");
    generateInviteLink(db, user1.id);
    generateInviteLink(db, user2.id);

    const links = listInviteLinks(db, user1.id);
    expect(links).toHaveLength(1);
    expect(links[0].createdBy).toBe(user1.id);
  });
});
