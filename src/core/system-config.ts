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
