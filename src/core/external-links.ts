import { and, eq } from "drizzle-orm";
import { taskExternalLinks } from "@/db/schema";
import type { Db } from "./types";

export interface CreateExternalLinkInput {
  userId: number;
  taskId: number;
  provider: string;
  externalId: string;
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

export function getExternalLinkByProviderId(
  db: Db,
  userId: number,
  provider: string,
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
