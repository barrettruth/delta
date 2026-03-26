import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { SafeUser } from "@/core/auth";
import { accounts, users } from "@/db/schema";
import type { Db } from "./types";

export type OAuthProvider = "github" | "google" | "gitlab";

export interface OAuthProfile {
  username: string;
  email?: string;
}

export function findAccountByProvider(
  db: Db,
  provider: OAuthProvider,
  providerAccountId: string,
) {
  return db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.provider, provider),
        eq(accounts.providerAccountId, providerAccountId),
      ),
    )
    .get();
}

export function linkAccount(
  db: Db,
  userId: number,
  provider: OAuthProvider,
  providerAccountId: string,
) {
  return db
    .insert(accounts)
    .values({ userId, provider, providerAccountId })
    .returning()
    .get();
}

export function unlinkAccount(db: Db, userId: number, provider: OAuthProvider) {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw new Error("User not found");

  const linkedAccounts = db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .all();

  const hasPassword = !!user.passwordHash;
  const otherAccounts = linkedAccounts.filter((a) => a.provider !== provider);

  if (!hasPassword && otherAccounts.length === 0) {
    throw new Error("Cannot unlink last auth method");
  }

  return db
    .delete(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)))
    .run();
}

export function getLinkedProviders(db: Db, userId: number): OAuthProvider[] {
  return db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .all()
    .map((a) => a.provider as OAuthProvider);
}

export function findUserFromOAuth(
  db: Db,
  provider: OAuthProvider,
  providerAccountId: string,
): SafeUser | null {
  const account = findAccountByProvider(db, provider, providerAccountId);
  if (!account) return null;
  const user = db
    .select()
    .from(users)
    .where(eq(users.id, account.userId))
    .get();
  if (!user) return null;
  const { passwordHash: _, ...safe } = user;
  return safe;
}

export function findOrCreateUserFromOAuth(
  db: Db,
  provider: OAuthProvider,
  providerAccountId: string,
  profile: OAuthProfile,
) {
  const existing = findAccountByProvider(db, provider, providerAccountId);
  if (existing) {
    const user = db
      .select()
      .from(users)
      .where(eq(users.id, existing.userId))
      .get();
    if (!user) throw new Error("Linked user not found");
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  const baseUsername = profile.username;
  let username = baseUsername;
  let attempt = 0;
  while (db.select().from(users).where(eq(users.username, username)).get()) {
    attempt++;
    username = `${baseUsername}${attempt}`;
  }

  const user = db
    .insert(users)
    .values({
      username,
      passwordHash: null,
      apiKey: randomBytes(32).toString("hex"),
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();

  linkAccount(db, user.id, provider, providerAccountId);

  const { passwordHash: _, ...safe } = user;
  return safe;
}
