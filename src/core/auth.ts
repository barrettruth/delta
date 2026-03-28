import { randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { inviteCodes, sessions, users } from "@/db/schema";
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

export function generateInviteCode(db: Db, userId: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(8);
  let suffix = "";
  for (let i = 0; i < 8; i++) {
    suffix += chars[bytes[i] % chars.length];
  }
  const code = `delta-${suffix}`;

  db.insert(inviteCodes)
    .values({
      code,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    })
    .run();

  return code;
}

export function validateInviteCode(db: Db, code: string) {
  return (
    db
      .select()
      .from(inviteCodes)
      .where(and(eq(inviteCodes.code, code), isNull(inviteCodes.usedBy)))
      .get() ?? null
  );
}

export function consumeInviteCode(
  db: Db,
  code: string,
  userId: number,
): boolean {
  const result = db
    .update(inviteCodes)
    .set({ usedBy: userId, usedAt: new Date().toISOString() })
    .where(and(eq(inviteCodes.code, code), isNull(inviteCodes.usedBy)))
    .run();
  return result.changes > 0;
}
