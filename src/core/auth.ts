import { randomBytes } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { users } from "@/db/schema";
import type { Db } from "./types";

export type User = typeof users.$inferSelect;
export type SafeUser = User;

function generateId(): string {
  return randomBytes(32).toString("hex");
}

function defaultLocalUsername(): string {
  return (
    process.env.DELTA_LOCAL_USERNAME?.trim() ||
    process.env.DELTA_USERNAME?.trim() ||
    "delta"
  );
}

export function getOrCreateLocalUser(db: Db): SafeUser {
  const existing = db
    .select()
    .from(users)
    .orderBy(asc(users.id))
    .limit(1)
    .get();

  if (existing) {
    return existing;
  }

  const user = db
    .insert(users)
    .values({
      username: defaultLocalUsername(),
      apiKey: generateId(),
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();

  return user;
}

export function findLocalUser(db: Db): SafeUser | null {
  const user = db.select().from(users).orderBy(asc(users.id)).limit(1).get();
  return user ?? null;
}

export function validateApiKey(db: Db, apiKey: string): SafeUser | null {
  const user = db.select().from(users).where(eq(users.apiKey, apiKey)).get();
  return user ?? null;
}

export function regenerateApiKey(db: Db, userId: number): string {
  const newKey = generateId();
  db.update(users).set({ apiKey: newKey }).where(eq(users.id, userId)).run();
  return newKey;
}

export function userExists(db: Db, username: string): boolean {
  return !!db.select().from(users).where(eq(users.username, username)).get();
}
