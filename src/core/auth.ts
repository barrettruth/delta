import { randomBytes } from "node:crypto";
import { compareSync, hashSync } from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { sessions, users } from "@/db/schema";
import type { Db } from "./types";

const BCRYPT_ROUNDS = 12;
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

export function createUser(
  db: Db,
  username: string,
  password: string,
): SafeUser {
  const existing = db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();
  if (existing) throw new Error("Username already taken");

  const user = db
    .insert(users)
    .values({
      username,
      passwordHash: hashSync(password, BCRYPT_ROUNDS),
      apiKey: generateId(),
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();

  return toSafeUser(user);
}

export function verifyPassword(
  db: Db,
  username: string,
  password: string,
): SafeUser | null {
  const user = db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .get();
  if (!user) return null;
  if (!user.passwordHash) return null;
  if (!compareSync(password, user.passwordHash)) return null;
  return toSafeUser(user);
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

export function userHasPassword(db: Db, userId: number): boolean {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  return !!user?.passwordHash;
}

export function regenerateApiKey(db: Db, userId: number): string {
  const newKey = generateId();
  db.update(users).set({ apiKey: newKey }).where(eq(users.id, userId)).run();
  return newKey;
}
