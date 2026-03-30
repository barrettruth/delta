import { and, eq } from "drizzle-orm";
import { integrationConfigs } from "@/db/schema";
import { decrypt, encrypt, getEncryptionKey } from "./encryption";
import type { Db } from "./types";

export interface IntegrationConfig {
  id: number;
  provider: string;
  tokens: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
  enabled: number;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationConfigSummary {
  provider: string;
  enabled: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export function getIntegrationConfig(
  db: Db,
  userId: number,
  provider: string,
): IntegrationConfig | null {
  const row = db
    .select()
    .from(integrationConfigs)
    .where(
      and(
        eq(integrationConfigs.userId, userId),
        eq(integrationConfigs.provider, provider),
      ),
    )
    .get();

  if (!row) return null;

  const key = getEncryptionKey();
  const tokens = JSON.parse(decrypt(row.encryptedTokens, key));
  const metadata = row.metadata ? JSON.parse(row.metadata) : null;

  return {
    id: row.id,
    provider: row.provider,
    tokens,
    metadata,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function upsertIntegrationConfig(
  db: Db,
  userId: number,
  provider: string,
  tokens: Record<string, unknown>,
  metadata?: Record<string, unknown>,
): IntegrationConfig {
  const key = getEncryptionKey();
  const encryptedTokens = encrypt(JSON.stringify(tokens), key);
  const metadataJson = metadata ? JSON.stringify(metadata) : null;
  const now = new Date().toISOString();

  const existing = db
    .select()
    .from(integrationConfigs)
    .where(
      and(
        eq(integrationConfigs.userId, userId),
        eq(integrationConfigs.provider, provider),
      ),
    )
    .get();

  let row: typeof integrationConfigs.$inferSelect;

  if (existing) {
    row = db
      .update(integrationConfigs)
      .set({
        encryptedTokens,
        metadata: metadataJson,
        updatedAt: now,
      })
      .where(eq(integrationConfigs.id, existing.id))
      .returning()
      .get();
  } else {
    row = db
      .insert(integrationConfigs)
      .values({
        userId,
        provider,
        encryptedTokens,
        metadata: metadataJson,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
  }

  return {
    id: row.id,
    provider: row.provider,
    tokens,
    metadata: metadata ?? null,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function setIntegrationEnabled(
  db: Db,
  userId: number,
  provider: string,
  enabled: number,
): boolean {
  const result = db
    .update(integrationConfigs)
    .set({ enabled, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(integrationConfigs.userId, userId),
        eq(integrationConfigs.provider, provider),
      ),
    )
    .run();

  return result.changes > 0;
}

export function deleteIntegrationConfig(
  db: Db,
  userId: number,
  provider: string,
): boolean {
  const result = db
    .delete(integrationConfigs)
    .where(
      and(
        eq(integrationConfigs.userId, userId),
        eq(integrationConfigs.provider, provider),
      ),
    )
    .run();

  return result.changes > 0;
}

export function listIntegrationConfigs(
  db: Db,
  userId: number,
): IntegrationConfigSummary[] {
  const rows = db
    .select({
      provider: integrationConfigs.provider,
      enabled: integrationConfigs.enabled,
      metadata: integrationConfigs.metadata,
      createdAt: integrationConfigs.createdAt,
      updatedAt: integrationConfigs.updatedAt,
    })
    .from(integrationConfigs)
    .where(eq(integrationConfigs.userId, userId))
    .all();

  return rows.map((row) => ({
    provider: row.provider,
    enabled: row.enabled,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}
