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
import { createTask, getTask, updateTask } from "@/core/task";
import type { Db } from "@/core/types";
import { getGoogleAccessToken } from "./oauth";
import { listGoogleTaskLists, listGoogleTasks } from "./tasks-client";
import { mapGoogleTask } from "./tasks-mapper";
import {
  changedGoogleTasksFields,
  hasTaskPatch,
  mergeGoogleTasksSnapshots,
  parseGoogleTasksLinkMetadata,
  snapshotFromDeltaTask,
  snapshotFromGoogleTask,
} from "./tasks-sync";
import {
  GOOGLE_PROVIDER,
  GOOGLE_TASKS_LINK_PROVIDER,
  type GoogleIntegrationMetadata,
  type GoogleTaskListSyncState,
  type GoogleTasksPullSummary,
  type GoogleTasksSyncState,
} from "./types";

function emptySummary(): GoogleTasksPullSummary {
  return {
    lists: 0,
    seen: 0,
    created: 0,
    updated: 0,
    cancelled: 0,
    skipped: 0,
    keptLocal: 0,
    conflicts: 0,
    remoteOutdated: 0,
    deletedProtected: 0,
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

function countSyncState(
  summary: GoogleTasksPullSummary,
  syncState: GoogleTasksSyncState,
): void {
  if (syncState === "local_modified") summary.keptLocal++;
  else if (syncState === "conflict") summary.conflicts++;
  else if (syncState === "remote_outdated") summary.remoteOutdated++;
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

  if (existing) {
    const task = getTask(db, existing.taskId);
    if (!task || task.userId !== userId) {
      throw new Error("Google task link points at a missing local task");
    }

    const parsedMetadata = parseGoogleTasksLinkMetadata(existing.metadata);
    const remoteSnapshot = snapshotFromGoogleTask(mapped);
    const localSnapshot = snapshotFromDeltaTask(task);
    const baseSnapshot = parsedMetadata.appliedSnapshot ?? remoteSnapshot;
    const merge = mergeGoogleTasksSnapshots({
      base: baseSnapshot,
      local: localSnapshot,
      remote: remoteSnapshot,
      remoteDeleted: mapped.metadata.deleted === true,
      task,
    });
    if (hasTaskPatch(merge.patch)) {
      updateTask(db, task.id, merge.patch);
    }
    const metadata = {
      ...parsedMetadata.metadata,
      ...mapped.metadata,
      syncState: merge.syncState,
      changedFields: merge.changedFields,
      lastAppliedAt: syncTime,
      lastRemoteUpdated:
        typeof mapped.metadata.updated === "string"
          ? mapped.metadata.updated
          : null,
      localUpdatedAt: merge.syncState === "clean" ? null : task.updatedAt,
      appliedSnapshot: merge.appliedSnapshot,
      remoteSnapshot: merge.remoteSnapshot,
    };
    updateExternalLink(db, existing.id, {
      metadata,
      lastSyncedAt: syncTime,
    });
    if (merge.appliedRemote) {
      if (merge.appliedCancellation) summary.cancelled++;
      else summary.updated++;
    }
    if (merge.syncState === "clean" && !merge.appliedRemote) {
      summary.skipped++;
    }
    countSyncState(summary, merge.syncState);
    if (merge.deletedProtected) summary.deletedProtected++;
    return;
  }

  if (mapped.input.status === "cancelled") {
    summary.skipped++;
    return;
  }

  const task = createTask(db, userId, mapped.input);
  const snapshot = snapshotFromGoogleTask(mapped);
  createExternalLink(db, {
    userId,
    taskId: task.id,
    provider: GOOGLE_TASKS_LINK_PROVIDER,
    externalId: mapped.externalId,
    metadata: {
      ...mapped.metadata,
      syncState: "clean",
      changedFields: [],
      lastAppliedAt: syncTime,
      lastRemoteUpdated:
        typeof mapped.metadata.updated === "string"
          ? mapped.metadata.updated
          : null,
      localUpdatedAt: null,
      appliedSnapshot: snapshot,
      remoteSnapshot: null,
    },
    lastSyncedAt: syncTime,
  });
  summary.created++;
}

function auditUnseenGoogleTaskLinks(
  db: Db,
  userId: number,
  processedExternalIds: ReadonlySet<string>,
  processedListIds: ReadonlySet<string>,
  syncTime: string,
  summary: GoogleTasksPullSummary,
): void {
  const links = listExternalLinksForProvider(
    db,
    userId,
    GOOGLE_TASKS_LINK_PROVIDER,
  );

  for (const link of links) {
    if (processedExternalIds.has(link.externalId)) continue;
    const task = getTask(db, link.taskId);
    if (!task || task.userId !== userId) continue;

    const parsed = parseGoogleTasksLinkMetadata(link.metadata);
    const listId =
      typeof parsed.metadata.listId === "string" ? parsed.metadata.listId : "";
    if (!processedListIds.has(listId)) continue;

    const appliedSnapshot = parsed.appliedSnapshot;
    if (!appliedSnapshot) continue;

    const localSnapshot = snapshotFromDeltaTask(task);
    const changedFields = changedGoogleTasksFields(
      localSnapshot,
      appliedSnapshot,
    );
    const resolvedRemoteIssue =
      parsed.remoteSnapshot &&
      changedGoogleTasksFields(localSnapshot, parsed.remoteSnapshot).length ===
        0;
    if (resolvedRemoteIssue) {
      updateExternalLink(db, link.id, {
        metadata: {
          ...parsed.metadata,
          syncState: "clean",
          changedFields: [],
          localUpdatedAt: null,
          appliedSnapshot: parsed.remoteSnapshot,
          remoteSnapshot: null,
        },
        lastSyncedAt: syncTime,
      });
      continue;
    }

    if (parsed.remoteSnapshot) {
      const merge = mergeGoogleTasksSnapshots({
        base: appliedSnapshot,
        local: localSnapshot,
        remote: parsed.remoteSnapshot,
        remoteDeleted: parsed.metadata.deleted === true,
        task,
      });
      if (hasTaskPatch(merge.patch)) {
        updateTask(db, task.id, merge.patch);
      }
      updateExternalLink(db, link.id, {
        metadata: {
          ...parsed.metadata,
          syncState: merge.syncState,
          changedFields: merge.changedFields,
          localUpdatedAt: merge.syncState === "clean" ? null : task.updatedAt,
          appliedSnapshot: merge.appliedSnapshot,
          remoteSnapshot: merge.remoteSnapshot,
        },
        lastSyncedAt: syncTime,
      });
      if (merge.appliedRemote) {
        if (merge.appliedCancellation) summary.cancelled++;
        else summary.updated++;
      }
      if (merge.syncState === "clean" && !merge.appliedRemote) {
        summary.skipped++;
      }
      countSyncState(summary, merge.syncState);
      if (merge.deletedProtected) summary.deletedProtected++;
      continue;
    }

    const existingIssueState =
      parsed.syncState === "conflict" || parsed.syncState === "remote_outdated"
        ? parsed.syncState
        : null;
    const syncState: GoogleTasksSyncState =
      existingIssueState ??
      (changedFields.length > 0 ? "local_modified" : "clean");
    const nextChangedFields =
      syncState === "clean"
        ? []
        : changedFields.length > 0
          ? changedFields
          : Array.isArray(parsed.metadata.changedFields)
            ? parsed.metadata.changedFields.filter(
                (field): field is (typeof changedFields)[number] =>
                  typeof field === "string",
              )
            : [];

    updateExternalLink(db, link.id, {
      metadata: {
        ...parsed.metadata,
        syncState,
        changedFields: nextChangedFields,
        localUpdatedAt: syncState === "clean" ? null : task.updatedAt,
        remoteSnapshot:
          syncState === "clean" ? null : (parsed.remoteSnapshot ?? null),
      },
      lastSyncedAt: syncTime,
    });
    countSyncState(summary, syncState);
  }
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
    const processedExternalIds = new Set<string>();
    const processedListIds = new Set<string>();
    const lists = await listGoogleTaskLists(accessToken);
    summary.lists = lists.length;

    for (const list of lists) {
      processedListIds.add(list.id);
      const tasks = await listGoogleTasks(accessToken, list.id, {
        updatedMin: cursorFor(metadata, list.id),
      });
      summary.seen += tasks.length;

      for (const task of tasks) {
        const mapped = mapGoogleTask(list, task, syncTime);
        processedExternalIds.add(mapped.externalId);
        applyMappedTask(db, userId, mapped, syncTime, summary);
      }

      listStates[list.id] = {
        title: list.title,
        updatedMin: syncTime,
      };
    }

    auditUnseenGoogleTaskLinks(
      db,
      userId,
      processedExternalIds,
      processedListIds,
      syncTime,
      summary,
    );

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
