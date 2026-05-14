import { and, eq } from "drizzle-orm";
import { syncSources, taskExternalLinks } from "@/db/schema";
import type { ExternalLinkProviderId } from "./external-link-providers";
import type { Db } from "./types";

/**
 * task_external_links owns imported or synced task identity.
 * Use provider for the upstream system and externalId for that system's stable
 * event/task id; provider-specific extras belong in metadata.
 */
export interface CreateExternalLinkInput {
  userId: number;
  taskId: number;
  syncSourceId?: number | null;
  provider: ExternalLinkProviderId;
  externalId: string;
  metadata?: Record<string, unknown> | null;
  lastSyncedAt?: string | null;
}

export interface UpdateExternalLinkInput {
  syncSourceId?: number | null;
  metadata?: Record<string, unknown> | null;
  lastSyncedAt?: string | null;
}

function now(): string {
  return new Date().toISOString();
}

export function createExternalLink(
  db: Db,
  input: CreateExternalLinkInput,
): typeof taskExternalLinks.$inferSelect {
  const ts = now();
  return db
    .insert(taskExternalLinks)
    .values({
      userId: input.userId,
      taskId: input.taskId,
      syncSourceId: input.syncSourceId ?? null,
      provider: input.provider,
      externalId: input.externalId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      lastSyncedAt: input.lastSyncedAt ?? null,
      createdAt: ts,
      updatedAt: ts,
    })
    .returning()
    .get();
}

export function updateExternalLink(
  db: Db,
  id: number,
  input: UpdateExternalLinkInput,
): typeof taskExternalLinks.$inferSelect {
  const patch: Partial<typeof taskExternalLinks.$inferInsert> = {
    updatedAt: now(),
  };
  if ("metadata" in input) {
    patch.metadata = input.metadata ? JSON.stringify(input.metadata) : null;
  }
  if ("syncSourceId" in input) {
    patch.syncSourceId = input.syncSourceId ?? null;
  }
  if ("lastSyncedAt" in input) {
    patch.lastSyncedAt = input.lastSyncedAt ?? null;
  }

  return db
    .update(taskExternalLinks)
    .set(patch)
    .where(eq(taskExternalLinks.id, id))
    .returning()
    .get();
}

export function getExternalLinkByProviderId(
  db: Db,
  userId: number,
  provider: ExternalLinkProviderId,
  externalId: string,
): typeof taskExternalLinks.$inferSelect | undefined {
  return db
    .select()
    .from(taskExternalLinks)
    .where(
      and(
        eq(taskExternalLinks.userId, userId),
        eq(taskExternalLinks.provider, provider),
        eq(taskExternalLinks.externalId, externalId),
      ),
    )
    .get();
}

export function listExternalLinksForTask(
  db: Db,
  taskId: number,
): (typeof taskExternalLinks.$inferSelect)[] {
  return db
    .select()
    .from(taskExternalLinks)
    .where(eq(taskExternalLinks.taskId, taskId))
    .all();
}

export function listExternalLinksForProvider(
  db: Db,
  userId: number,
  provider: ExternalLinkProviderId,
): (typeof taskExternalLinks.$inferSelect)[] {
  return db
    .select()
    .from(taskExternalLinks)
    .where(
      and(
        eq(taskExternalLinks.userId, userId),
        eq(taskExternalLinks.provider, provider),
      ),
    )
    .all();
}

export function isReadOnlyImportedTask(
  db: Db,
  userId: number,
  taskId: number,
): boolean {
  const match = db
    .select({ id: taskExternalLinks.id })
    .from(taskExternalLinks)
    .innerJoin(syncSources, eq(taskExternalLinks.syncSourceId, syncSources.id))
    .where(
      and(
        eq(taskExternalLinks.userId, userId),
        eq(taskExternalLinks.taskId, taskId),
        eq(syncSources.readOnly, 1),
      ),
    )
    .get();

  return Boolean(match);
}
