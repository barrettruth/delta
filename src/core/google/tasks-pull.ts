import {
  createExternalLink,
  getExternalLinkByProviderId,
  updateExternalLink,
} from "@/core/external-links";
import {
  getIntegrationConfig,
  upsertIntegrationConfig,
} from "@/core/integration-config";
import { createTask, getTask, updateTask } from "@/core/task";
import type { Db } from "@/core/types";
import { getGoogleAccessToken } from "./oauth";
import { listGoogleTaskLists, listGoogleTasks } from "./tasks-client";
import { mapGoogleTask } from "./tasks-mapper";
import {
  GOOGLE_PROVIDER,
  GOOGLE_TASKS_LINK_PROVIDER,
  type GoogleIntegrationMetadata,
  type GoogleTaskListSyncState,
  type GoogleTasksPullSummary,
} from "./types";

function emptySummary(): GoogleTasksPullSummary {
  return {
    lists: 0,
    seen: 0,
    created: 0,
    updated: 0,
    cancelled: 0,
    skipped: 0,
  };
}

function metadataFor(db: Db, userId: number): GoogleIntegrationMetadata {
  const config = getIntegrationConfig(db, userId, GOOGLE_PROVIDER);
  return (config?.metadata ?? {}) as GoogleIntegrationMetadata;
}

function saveMetadata(
  db: Db,
  userId: number,
  metadata: GoogleIntegrationMetadata,
): void {
  const config = getIntegrationConfig(db, userId, GOOGLE_PROVIDER);
  if (!config) return;
  upsertIntegrationConfig(db, userId, GOOGLE_PROVIDER, config.tokens, metadata);
}

function shouldSkip(
  existingMetadata: string | null,
  incoming: Record<string, unknown>,
): boolean {
  if (!existingMetadata) return false;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(existingMetadata) as Record<string, unknown>;
  } catch {
    return false;
  }
  return (
    parsed.etag === incoming.etag &&
    parsed.updated === incoming.updated &&
    parsed.deleted === incoming.deleted &&
    parsed.hidden === incoming.hidden
  );
}

function applyMappedTask(
  db: Db,
  userId: number,
  mapped: ReturnType<typeof mapGoogleTask>,
  syncTime: string,
  summary: GoogleTasksPullSummary,
): void {
  db.transaction((tx) => {
    const txDb = tx as Db;
    applyMappedTaskInTransaction(txDb, userId, mapped, syncTime, summary);
  });
}

function applyMappedTaskInTransaction(
  db: Db,
  userId: number,
  mapped: ReturnType<typeof mapGoogleTask>,
  syncTime: string,
  summary: GoogleTasksPullSummary,
): void {
  const existing = getExternalLinkByProviderId(
    db,
    userId,
    GOOGLE_TASKS_LINK_PROVIDER,
    mapped.externalId,
  );

  if (existing && shouldSkip(existing.metadata, mapped.metadata)) {
    updateExternalLink(db, existing.id, {
      metadata: mapped.metadata,
      lastSyncedAt: syncTime,
    });
    summary.skipped++;
    return;
  }

  if (existing) {
    const task = getTask(db, existing.taskId);
    if (!task || task.userId !== userId) {
      throw new Error("Google task link points at a missing local task");
    }

    updateTask(db, task.id, mapped.input);
    updateExternalLink(db, existing.id, {
      metadata: mapped.metadata,
      lastSyncedAt: syncTime,
    });
    if (mapped.input.status === "cancelled") summary.cancelled++;
    else summary.updated++;
    return;
  }

  if (mapped.input.status === "cancelled") {
    summary.skipped++;
    return;
  }

  const task = createTask(db, userId, mapped.input);
  createExternalLink(db, {
    userId,
    taskId: task.id,
    provider: GOOGLE_TASKS_LINK_PROVIDER,
    externalId: mapped.externalId,
    metadata: mapped.metadata,
    lastSyncedAt: syncTime,
  });
  summary.created++;
}

function cursorFor(
  metadata: GoogleIntegrationMetadata,
  listId: string,
): string | undefined {
  return metadata.tasks?.lists?.[listId]?.updatedMin;
}

export async function pullGoogleTasks(
  db: Db,
  userId: number,
): Promise<GoogleTasksPullSummary> {
  let metadata = metadataFor(db, userId);
  const summary = emptySummary();
  const syncTime = new Date().toISOString();

  try {
    const accessToken = await getGoogleAccessToken(db, userId);
    metadata = metadataFor(db, userId);
    const listStates: Record<string, GoogleTaskListSyncState> = {
      ...(metadata.tasks?.lists ?? {}),
    };
    const lists = await listGoogleTaskLists(accessToken);
    summary.lists = lists.length;

    for (const list of lists) {
      const tasks = await listGoogleTasks(accessToken, list.id, {
        updatedMin: cursorFor(metadata, list.id),
      });
      summary.seen += tasks.length;

      for (const task of tasks) {
        applyMappedTask(
          db,
          userId,
          mapGoogleTask(list, task, syncTime),
          syncTime,
          summary,
        );
      }

      listStates[list.id] = {
        title: list.title,
        updatedMin: syncTime,
      };
    }

    saveMetadata(db, userId, {
      ...metadata,
      lastError: undefined,
      tasks: {
        ...(metadata.tasks ?? {}),
        lastPulledAt: syncTime,
        lastResult: summary,
        lists: listStates,
      },
    });

    return summary;
  } catch (error) {
    saveMetadata(db, userId, {
      ...metadata,
      lastError:
        error instanceof Error ? error.message : "Google Tasks pull failed",
    });
    throw error;
  }
}
