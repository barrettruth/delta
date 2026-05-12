import { beforeEach, describe, expect, it } from "vitest";
import {
  generateFeedToken,
  getFeedToken,
  getUserByFeedToken,
  revokeFeedToken,
} from "@/core/calendar-feed";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../helpers";

let db: Db;
let userId: number;

beforeEach(() => {
  db = createTestDb();
  const user = createTestUser(db, "feeduser");
  userId = user.id;
});

describe("calendar feed tokens", () => {
  it("stores one feed token per user outside the user record", () => {
    expect(getFeedToken(db, userId)).toBeNull();

    const token = generateFeedToken(db, userId);

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(getFeedToken(db, userId)).toBe(token);
    expect(getUserByFeedToken(db, token)).toMatchObject({
      id: userId,
      username: "feeduser",
    });
  });

  it("rotates the token and invalidates the previous feed URL token", () => {
    const previous = generateFeedToken(db, userId);
    const next = generateFeedToken(db, userId);

    expect(next).not.toBe(previous);
    expect(getFeedToken(db, userId)).toBe(next);
    expect(getUserByFeedToken(db, previous)).toBeNull();
    expect(getUserByFeedToken(db, next)?.id).toBe(userId);
  });

  it("revokes the token by removing the feed storage row", () => {
    const token = generateFeedToken(db, userId);

    revokeFeedToken(db, userId);

    expect(getFeedToken(db, userId)).toBeNull();
    expect(getUserByFeedToken(db, token)).toBeNull();
  });
});
