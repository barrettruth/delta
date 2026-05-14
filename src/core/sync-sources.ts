import { and, eq } from "drizzle-orm";
import { syncSources } from "@/db/schema";
import type { Db } from "./types";

export const SYNC_SOURCE_PROVIDER = {
  google: "google",
} as const;

export type SyncSourceProviderId =
  (typeof SYNC_SOURCE_PROVIDER)[keyof typeof SYNC_SOURCE_PROVIDER];

export const SYNC_SOURCE_KIND = {
  googleTasksList: "google_tasks_list",
  googleCalendar: "google_calendar",
} as const;

export type SyncSourceKind =
  (typeof SYNC_SOURCE_KIND)[keyof typeof SYNC_SOURCE_KIND];

export type SyncSource = typeof syncSources.$inferSelect;

export interface CreateSyncSourceInput {
  userId: number;
  provider: string;
  sourceKind: string;
  sourceId: string;
  title: string;
  enabled?: number;
  readOnly?: number;
  defaultCategory?: string | null;
  syncCursor?: string | null;
  lastSyncedAt?: string | null;
  lastResult?: Record<string, unknown> | null;
  lastError?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateSyncSourceInput {
  title?: string;
  enabled?: number;
  readOnly?: number;
  defaultCategory?: string | null;
  syncCursor?: string | null;
  lastSyncedAt?: string | null;
  lastResult?: Record<string, unknown> | null;
  lastError?: string | null;
  metadata?: Record<string, unknown> | null;
}

function timestamp(): string {
  return new Date().toISOString();
}

function jsonOrNull(value: Record<string, unknown> | null | undefined) {
  return value ? JSON.stringify(value) : null;
}

function toInsert(input: CreateSyncSourceInput) {
  const ts = timestamp();
  return {
    userId: input.userId,
    provider: input.provider,
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    title: input.title,
    enabled: input.enabled ?? 1,
    readOnly: input.readOnly ?? 1,
    defaultCategory: input.defaultCategory ?? null,
    syncCursor: input.syncCursor ?? null,
    lastSyncedAt: input.lastSyncedAt ?? null,
    lastResult: jsonOrNull(input.lastResult),
    lastError: input.lastError ?? null,
    metadata: jsonOrNull(input.metadata),
    createdAt: ts,
    updatedAt: ts,
  };
}

function toUpdate(input: UpdateSyncSourceInput) {
  const patch: Partial<typeof syncSources.$inferInsert> = {
    updatedAt: timestamp(),
  };

  if (input.title !== undefined) patch.title = input.title;
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.readOnly !== undefined) patch.readOnly = input.readOnly;
  if (input.defaultCategory !== undefined) {
    patch.defaultCategory = input.defaultCategory ?? null;
  }
  if (input.syncCursor !== undefined)
    patch.syncCursor = input.syncCursor ?? null;
  if (input.lastSyncedAt !== undefined) {
    patch.lastSyncedAt = input.lastSyncedAt ?? null;
  }
  if (input.lastResult !== undefined)
    patch.lastResult = jsonOrNull(input.lastResult);
  if (input.lastError !== undefined) patch.lastError = input.lastError ?? null;
  if (input.metadata !== undefined) patch.metadata = jsonOrNull(input.metadata);

  return patch;
}

export function createSyncSource(
  db: Db,
  input: CreateSyncSourceInput,
): SyncSource {
  return db.insert(syncSources).values(toInsert(input)).returning().get();
}

export function getSyncSource(db: Db, id: number): SyncSource | undefined {
  return db.select().from(syncSources).where(eq(syncSources.id, id)).get();
}

export function getSyncSourceByProviderSourceId(
  db: Db,
  userId: number,
  provider: string,
  sourceKind: string,
  sourceId: string,
): SyncSource | undefined {
  return db
    .select()
    .from(syncSources)
    .where(
      and(
        eq(syncSources.userId, userId),
        eq(syncSources.provider, provider),
        eq(syncSources.sourceKind, sourceKind),
        eq(syncSources.sourceId, sourceId),
      ),
    )
    .get();
}

export function listSyncSources(
  db: Db,
  userId: number,
  filters: { provider?: string; sourceKind?: string } = {},
): SyncSource[] {
  const conditions = [eq(syncSources.userId, userId)];
  if (filters.provider) {
    conditions.push(eq(syncSources.provider, filters.provider));
  }
  if (filters.sourceKind) {
    conditions.push(eq(syncSources.sourceKind, filters.sourceKind));
  }

  return db
    .select()
    .from(syncSources)
    .where(and(...conditions))
    .all();
}

export function updateSyncSource(
  db: Db,
  id: number,
  input: UpdateSyncSourceInput,
): SyncSource {
  return db
    .update(syncSources)
    .set(toUpdate(input))
    .where(eq(syncSources.id, id))
    .returning()
    .get();
}

export function upsertSyncSource(
  db: Db,
  input: CreateSyncSourceInput,
): SyncSource {
  const existing = getSyncSourceByProviderSourceId(
    db,
    input.userId,
    input.provider,
    input.sourceKind,
    input.sourceId,
  );

  if (!existing) return createSyncSource(db, input);

  return updateSyncSource(db, existing.id, {
    title: input.title,
    enabled: input.enabled,
    readOnly: input.readOnly,
    defaultCategory: input.defaultCategory,
    syncCursor: input.syncCursor,
    lastSyncedAt: input.lastSyncedAt,
    lastResult: input.lastResult,
    lastError: input.lastError,
    metadata: input.metadata,
  });
}

export function deleteSyncSource(db: Db, id: number): boolean {
  const result = db.delete(syncSources).where(eq(syncSources.id, id)).run();
  return result.changes > 0;
}
