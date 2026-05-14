import {
  createExternalLink,
  getExternalLinkByProviderId,
  listExternalLinksForProvider,
  updateExternalLink,
} from "@/core/external-links";
import {
  getIntegrationConfig,
  upsertIntegrationConfig,
} from "@/core/integration-config";
import {
  createSyncSource,
  getSyncSourceByProviderSourceId,
  SYNC_SOURCE_KIND,
  type SyncSource,
  updateSyncSource,
} from "@/core/sync-sources";
import { createTask, getTask, updateTaskFromSync } from "@/core/task";
import type { Db, Task, UpdateTaskInput } from "@/core/types";
import { getGoogleAccessToken } from "./oauth";
import { listGoogleTaskLists, listGoogleTasks } from "./tasks-client";
import { mapGoogleTask } from "./tasks-mapper";
import {
  changedGoogleTasksFields,
  parseGoogleTasksLinkMetadata,
  snapshotFromDeltaTask,
  snapshotFromGoogleTask,
} from "./tasks-sync";
import {
  GOOGLE_PROVIDER,
  GOOGLE_TASKS_LINK_PROVIDER,
  type GoogleIntegrationMetadata,
  type GoogleTaskList,
  type GoogleTasksMappedTask,
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
    duplicateSkipped: 0,
    errors: [],
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

function legacyCursorFor(
  metadata: GoogleIntegrationMetadata,
  listId: string,
): string | undefined {
  const tasks = metadata.tasks as
    | { lists?: Record<string, { updatedMin?: unknown }> }
    | undefined;
  const value = tasks?.lists?.[listId]?.updatedMin;
  return typeof value === "string" ? value : undefined;
}

function sourceMetadata(list: GoogleTaskList): Record<string, unknown> {
  return {
    listId: list.id,
    title: list.title,
    etag: list.etag ?? null,
    updated: list.updated ?? null,
    selfLink: list.selfLink ?? null,
  };
}

function ensureGoogleTasksSource(
  db: Db,
  userId: number,
  list: GoogleTaskList,
  metadata: GoogleIntegrationMetadata,
): SyncSource {
  const existing = getSyncSourceByProviderSourceId(
    db,
    userId,
    GOOGLE_PROVIDER,
    SYNC_SOURCE_KIND.googleTasksList,
    list.id,
  );

  if (!existing) {
    return createSyncSource(db, {
      userId,
      provider: GOOGLE_PROVIDER,
      sourceKind: SYNC_SOURCE_KIND.googleTasksList,
      sourceId: list.id,
      title: list.title,
      defaultCategory: list.title || "Todo",
      syncCursor: legacyCursorFor(metadata, list.id) ?? null,
      metadata: sourceMetadata(list),
      readOnly: 1,
    });
  }

  return updateSyncSource(db, existing.id, {
    title: list.title,
    defaultCategory: existing.defaultCategory ?? list.title ?? "Todo",
    metadata: sourceMetadata(list),
    readOnly: 1,
  });
}

function listIdFromLinkMetadata(
  link: ReturnType<typeof listExternalLinksForProvider>[number],
): string | null {
  const parsed = parseGoogleTasksLinkMetadata(link.metadata);
  if (typeof parsed.metadata.listId === "string") return parsed.metadata.listId;
  const separator = link.externalId.indexOf(":");
  return separator > 0 ? link.externalId.slice(0, separator) : null;
}

function linkExistingImportsToSource(
  db: Db,
  userId: number,
  source: SyncSource,
): void {
  const links = listExternalLinksForProvider(
    db,
    userId,
    GOOGLE_TASKS_LINK_PROVIDER,
  );

  for (const link of links) {
    if (link.syncSourceId === source.id) continue;
    if (listIdFromLinkMetadata(link) !== source.sourceId) continue;
    updateExternalLink(db, link.id, { syncSourceId: source.id });
  }
}

function patchFromMappedTask(
  task: Task,
  mapped: GoogleTasksMappedTask,
): UpdateTaskInput {
  const patch: UpdateTaskInput = { ...mapped.input };

  if (task.recurrence && !task.startAt && mapped.input.due === null) {
    patch.recurrence = null;
    patch.recurMode = null;
  }

  return patch;
}

function updateImportedLink(
  db: Db,
  linkId: number,
  sourceId: number,
  mapped: GoogleTasksMappedTask,
  syncTime: string,
): void {
  const snapshot = snapshotFromGoogleTask(mapped);
  updateExternalLink(db, linkId, {
    syncSourceId: sourceId,
    metadata: {
      ...mapped.metadata,
      readOnly: true,
      lastAppliedAt: syncTime,
      lastRemoteUpdated:
        typeof mapped.metadata.updated === "string"
          ? mapped.metadata.updated
          : null,
      appliedSnapshot: snapshot,
    },
    lastSyncedAt: syncTime,
  });
}

function applyMappedTaskInTransaction(
  db: Db,
  userId: number,
  source: SyncSource,
  mapped: GoogleTasksMappedTask,
  syncTime: string,
  summary: GoogleTasksPullSummary,
): void {
  const existing = getExternalLinkByProviderId(
    db,
    userId,
    GOOGLE_TASKS_LINK_PROVIDER,
    mapped.externalId,
  );

  if (existing) {
    const task = getTask(db, existing.taskId);
    if (!task || task.userId !== userId) {
      throw new Error("Google task link points at a missing local task");
    }

    const before = snapshotFromDeltaTask(task);
    const incoming = snapshotFromGoogleTask(mapped);
    const changed = changedGoogleTasksFields(before, incoming).length > 0;

    if (changed) {
      updateTaskFromSync(db, task.id, patchFromMappedTask(task, mapped));
    }

    updateImportedLink(db, existing.id, source.id, mapped, syncTime);
    if (changed && mapped.input.status === "cancelled") summary.cancelled++;
    else if (changed) summary.updated++;
    else summary.skipped++;
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
    syncSourceId: source.id,
    provider: GOOGLE_TASKS_LINK_PROVIDER,
    externalId: mapped.externalId,
    metadata: {
      ...mapped.metadata,
      readOnly: true,
      lastAppliedAt: syncTime,
      lastRemoteUpdated:
        typeof mapped.metadata.updated === "string"
          ? mapped.metadata.updated
          : null,
      appliedSnapshot: snapshotFromGoogleTask(mapped),
    },
    lastSyncedAt: syncTime,
  });
  summary.created++;
}

function applyMappedTask(
  db: Db,
  userId: number,
  source: SyncSource,
  mapped: GoogleTasksMappedTask,
  syncTime: string,
  summary: GoogleTasksPullSummary,
): void {
  db.transaction((tx) => {
    applyMappedTaskInTransaction(
      tx as Db,
      userId,
      source,
      mapped,
      syncTime,
      summary,
    );
  });
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
    const lists = await listGoogleTaskLists(accessToken);
    summary.lists = lists.length;

    for (const list of lists) {
      const source = ensureGoogleTasksSource(db, userId, list, metadata);
      linkExistingImportsToSource(db, userId, source);
      const tasks = await listGoogleTasks(accessToken, list.id, {
        updatedMin: source.syncCursor ?? undefined,
      });
      summary.seen += tasks.length;

      for (const task of tasks) {
        const mapped = mapGoogleTask(list, task, syncTime);
        applyMappedTask(db, userId, source, mapped, syncTime, summary);
      }

      updateSyncSource(db, source.id, {
        syncCursor: syncTime,
        lastSyncedAt: syncTime,
        lastResult: {
          seen: tasks.length,
        },
        lastError: null,
      });
    }

    saveMetadata(db, userId, {
      ...metadata,
      lastError: undefined,
      tasks: {
        lastPulledAt: syncTime,
        lastResult: summary,
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
