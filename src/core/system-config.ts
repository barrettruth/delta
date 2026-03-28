import { eq } from "drizzle-orm";
import { systemConfigs } from "@/db/schema";
import { decrypt, encrypt, getEncryptionKey } from "./encryption";
import type { Db } from "./types";

export function getSystemConfig(db: Db, key: string): string | null {
  const row = db
    .select()
    .from(systemConfigs)
    .where(eq(systemConfigs.key, key))
    .get();

  if (!row) return null;

  const encryptionKey = getEncryptionKey();
  return decrypt(row.value, encryptionKey);
}

export function setSystemConfig(db: Db, key: string, value: string): void {
  const encryptionKey = getEncryptionKey();
  const encrypted = encrypt(value, encryptionKey);
  const now = new Date().toISOString();

  const existing = db
    .select()
    .from(systemConfigs)
    .where(eq(systemConfigs.key, key))
    .get();

  if (existing) {
    db.update(systemConfigs)
      .set({ value: encrypted, updatedAt: now })
      .where(eq(systemConfigs.key, key))
      .run();
  } else {
    db.insert(systemConfigs)
      .values({ key, value: encrypted, createdAt: now, updatedAt: now })
      .run();
  }
}

export function deleteSystemConfig(db: Db, key: string): boolean {
  const result = db
    .delete(systemConfigs)
    .where(eq(systemConfigs.key, key))
    .run();

  return result.changes > 0;
}

export function getOAuthProviderConfig(
  db: Db,
  provider: string,
): { clientId: string; clientSecret: string } | null {
  const clientId = getSystemConfig(db, `oauth.${provider}.client_id`);
  const clientSecret = getSystemConfig(db, `oauth.${provider}.client_secret`);

  if (!clientId || !clientSecret) return null;

  return { clientId, clientSecret };
}

export function setOAuthProviderConfig(
  db: Db,
  provider: string,
  clientId: string,
  clientSecret: string,
): void {
  setSystemConfig(db, `oauth.${provider}.client_id`, clientId);
  setSystemConfig(db, `oauth.${provider}.client_secret`, clientSecret);
}

export function deleteOAuthProviderConfig(db: Db, provider: string): boolean {
  const a = deleteSystemConfig(db, `oauth.${provider}.client_id`);
  const b = deleteSystemConfig(db, `oauth.${provider}.client_secret`);
  return a || b;
}

export function isOAuthProviderConfigured(db: Db, provider: string): boolean {
  const config = getOAuthProviderConfig(db, provider);
  return config !== null;
}
