import { randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { inviteLinks, sessions, users } from "@/db/schema";
import type { Db } from "./types";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, "passwordHash">;

function generateId(): string {
  return randomBytes(32).toString("hex");
}

function toSafeUser(user: User): SafeUser {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

export function userExists(db: Db, username: string): boolean {
  return !!db.select().from(users).where(eq(users.username, username)).get();
}

export function createSession(db: Db, userId: number): string {
  const id = generateId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  db.insert(sessions)
    .values({
      id,
      userId,
      expiresAt,
      createdAt: new Date().toISOString(),
    })
    .run();

  return id;
}

export function validateSession(db: Db, sessionId: string): SafeUser | null {
  const row = db
    .select()
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, sessionId),
        gt(sessions.expiresAt, new Date().toISOString()),
      ),
    )
    .get();

  if (!row) return null;
  return toSafeUser(row.users);
}

export function deleteSession(db: Db, sessionId: string): void {
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}

export function validateApiKey(db: Db, apiKey: string): SafeUser | null {
  const user = db.select().from(users).where(eq(users.apiKey, apiKey)).get();
  if (!user) return null;
  return toSafeUser(user);
}

export function regenerateApiKey(db: Db, userId: number): string {
  const newKey = generateId();
  db.update(users).set({ apiKey: newKey }).where(eq(users.id, userId)).run();
  return newKey;
}

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export function generateInviteLink(
  db: Db,
  userId: number,
  maxUses = 1,
): string {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();

  db.insert(inviteLinks)
    .values({
      token,
      createdBy: userId,
      expiresAt: new Date(now.getTime() + INVITE_EXPIRY_MS).toISOString(),
      maxUses,
      useCount: 0,
      createdAt: now.toISOString(),
    })
    .run();

  return token;
}

export function validateInviteToken(db: Db, token: string) {
  const row = db
    .select()
    .from(inviteLinks)
    .where(
      and(
        eq(inviteLinks.token, token),
        gt(inviteLinks.expiresAt, new Date().toISOString()),
      ),
    )
    .get();

  if (!row) return null;
  if (row.useCount >= row.maxUses) return null;
  return row;
}

export function consumeInviteToken(
  db: Db,
  token: string,
  userId: number,
): boolean {
  const row = validateInviteToken(db, token);
  if (!row) return false;

  const result = db
    .update(inviteLinks)
    .set({
      useCount: row.useCount + 1,
      usedBy: userId,
      usedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(inviteLinks.token, token),
        lt(inviteLinks.useCount, inviteLinks.maxUses),
      ),
    )
    .run();
  return result.changes > 0;
}

export function listInviteLinks(db: Db, userId: number) {
  return db
    .select()
    .from(inviteLinks)
    .where(eq(inviteLinks.createdBy, userId))
    .all();
}
