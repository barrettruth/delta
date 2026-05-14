import { EXTERNAL_LINK_PROVIDER } from "@/core/external-link-providers";
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
  listSyncSources,
  SYNC_SOURCE_KIND,
  type SyncSource,
  updateSyncSource,
} from "@/core/sync-sources";
import { createTask, getTask, updateTaskFromSync } from "@/core/task";
import type { CreateTaskInput, Db, Task, UpdateTaskInput } from "@/core/types";
import {
  GoogleCalendarApiError,
  listGoogleCalendarEventsPage,
} from "./calendar-client";
import {
  type GoogleCalendarCancelledEvent,
  type GoogleCalendarMappedEvent,
  mapGoogleCalendarEvents,
} from "./calendar-mapper";
import { getGoogleAccessToken } from "./oauth";
import {
  GOOGLE_PROVIDER,
  type GoogleCalendarEvent,
  type GoogleCalendarPullSummary,
  type GoogleCalendarSourceSummary,
  type GoogleIntegrationMetadata,
} from "./types";

function emptySummary(): GoogleCalendarPullSummary {
  return {
    sources: 0,
    seen: 0,
    created: 0,
    updated: 0,
    cancelled: 0,
    skipped: 0,
    duplicateSkipped: 0,
    fullResyncs: 0,
    errors: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonObject(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function sourceSummary(source: SyncSource): GoogleCalendarSourceSummary {
  const metadata = parseJsonObject(source.metadata);
  return {
    id: source.id,
    sourceId: source.sourceId,
    title: source.title,
    enabled: source.enabled === 1,
    hidden: metadata.hidden === true,
    accessRole:
      typeof metadata.accessRole === "string" ? metadata.accessRole : null,
    timeZone: typeof metadata.timeZone === "string" ? metadata.timeZone : null,
    defaultCategory: source.defaultCategory ?? source.title,
    backgroundColor:
      typeof metadata.backgroundColor === "string"
        ? metadata.backgroundColor
        : null,
    foregroundColor:
      typeof metadata.foregroundColor === "string"
        ? metadata.foregroundColor
        : null,
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

function selectedCalendarSources(db: Db, userId: number): SyncSource[] {
  return listSyncSources(db, userId, {
    provider: GOOGLE_PROVIDER,
    sourceKind: SYNC_SOURCE_KIND.googleCalendar,
  }).filter((source) => source.enabled === 1);
}

async function fetchEventsForSource(
  accessToken: string,
  source: SyncSource,
): Promise<{
  events: GoogleCalendarEvent[];
  nextSyncToken: string | null;
  fullResync: boolean;
}> {
  async function fetchPages(syncToken: string | null) {
    const events: GoogleCalendarEvent[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | null = null;

    do {
      const page = await listGoogleCalendarEventsPage(
        accessToken,
        source.sourceId,
        {
          pageToken,
          syncToken: syncToken ?? undefined,
        },
      );
      events.push(...page.items);
      pageToken = page.nextPageToken;
      if (!pageToken) nextSyncToken = page.nextSyncToken ?? null;
    } while (pageToken);

    return { events, nextSyncToken };
  }

  try {
    const result = await fetchPages(source.syncCursor);
    return { ...result, fullResync: false };
  } catch (error) {
    if (error instanceof GoogleCalendarApiError && error.status === 410) {
      const result = await fetchPages(null);
      return { ...result, fullResync: true };
    }
    throw error;
  }
}

function existingICalUIDs(db: Db, userId: number): Set<string> {
  const links = listExternalLinksForProvider(
    db,
    userId,
    EXTERNAL_LINK_PROVIDER.ical,
  );
  return new Set(links.map((link) => link.externalId.split("::")[0]));
}

function valueForTask(task: Task, key: keyof UpdateTaskInput): unknown {
  return task[key as keyof Task] ?? null;
}

function patchFromInput(task: Task, input: CreateTaskInput): UpdateTaskInput {
  const patch: UpdateTaskInput = {};
  const keys: Array<keyof UpdateTaskInput & keyof CreateTaskInput> = [
    "description",
    "status",
    "category",
    "due",
    "completedAt",
    "startAt",
    "endAt",
    "allDay",
    "timezone",
    "recurrence",
    "recurMode",
    "notes",
    "order",
    "location",
    "locationLat",
    "locationLon",
    "meetingUrl",
    "exdates",
    "rdates",
  ];

  for (const key of keys) {
    if (!(key in input)) continue;
    const next = input[key] ?? null;
    if (valueForTask(task, key) !== next) {
      (patch as Record<string, unknown>)[key] = next;
    }
  }

  return patch;
}

function hasPatch(input: UpdateTaskInput): boolean {
  return Object.keys(input).length > 0;
}

function linkMetadata(
  mapped: GoogleCalendarMappedEvent | GoogleCalendarCancelledEvent,
  syncTime: string,
) {
  return {
    ...mapped.metadata,
    readOnly: true,
    lastAppliedAt: syncTime,
  };
}

function updateImportedLink(
  db: Db,
  linkId: number,
  sourceId: number,
  mapped: GoogleCalendarMappedEvent | GoogleCalendarCancelledEvent,
  syncTime: string,
): void {
  updateExternalLink(db, linkId, {
    syncSourceId: sourceId,
    metadata: linkMetadata(mapped, syncTime),
    lastSyncedAt: syncTime,
  });
}

function setRecurringMasterId(
  db: Db,
  userId: number,
  input: CreateTaskInput,
  mapped: GoogleCalendarMappedEvent,
): CreateTaskInput | null {
  if (!mapped.recurringMasterExternalId) return input;
  const master = getExternalLinkByProviderId(
    db,
    userId,
    EXTERNAL_LINK_PROVIDER.googleCalendar,
    mapped.recurringMasterExternalId,
  );
  if (!master) return null;
  return { ...input, recurringTaskId: master.taskId };
}

function applyMappedEvent(
  db: Db,
  userId: number,
  source: SyncSource,
  mapped: GoogleCalendarMappedEvent,
  syncTime: string,
  summary: GoogleCalendarPullSummary,
): void {
  const existing = getExternalLinkByProviderId(
    db,
    userId,
    EXTERNAL_LINK_PROVIDER.googleCalendar,
    mapped.externalId,
  );

  if (existing) {
    const task = getTask(db, existing.taskId);
    if (!task || task.userId !== userId) {
      throw new Error("Google Calendar link points at a missing local task");
    }

    const patch = patchFromInput(task, mapped.input);
    if (hasPatch(patch)) {
      updateTaskFromSync(db, task.id, patch);
      if (patch.status === "cancelled") summary.cancelled++;
      else summary.updated++;
    } else {
      summary.skipped++;
    }
    updateImportedLink(db, existing.id, source.id, mapped, syncTime);
    return;
  }

  if (mapped.input.status === "cancelled") {
    summary.skipped++;
    return;
  }

  const input = setRecurringMasterId(db, userId, mapped.input, mapped);
  if (!input) {
    summary.skipped++;
    return;
  }

  const task = createTask(db, userId, input);
  createExternalLink(db, {
    userId,
    taskId: task.id,
    syncSourceId: source.id,
    provider: EXTERNAL_LINK_PROVIDER.googleCalendar,
    externalId: mapped.externalId,
    metadata: linkMetadata(mapped, syncTime),
    lastSyncedAt: syncTime,
  });
  summary.created++;
}

function addMasterExdate(db: Db, task: Task, originalStartAt: string): boolean {
  const existing = task.exdates ? (JSON.parse(task.exdates) as string[]) : [];
  if (existing.includes(originalStartAt)) return false;
  updateTaskFromSync(db, task.id, {
    exdates: JSON.stringify([...existing, originalStartAt]),
  });
  return true;
}

function applyCancelledEvent(
  db: Db,
  userId: number,
  source: SyncSource,
  cancelled: GoogleCalendarCancelledEvent,
  syncTime: string,
  summary: GoogleCalendarPullSummary,
): void {
  const existing = getExternalLinkByProviderId(
    db,
    userId,
    EXTERNAL_LINK_PROVIDER.googleCalendar,
    cancelled.externalId,
  );

  if (existing) {
    const task = getTask(db, existing.taskId);
    if (!task || task.userId !== userId) {
      throw new Error("Google Calendar link points at a missing local task");
    }
    if (task.status !== "cancelled") {
      updateTaskFromSync(db, task.id, { status: "cancelled" });
      summary.cancelled++;
    } else {
      summary.skipped++;
    }
    updateImportedLink(db, existing.id, source.id, cancelled, syncTime);
    return;
  }

  if (!cancelled.recurringMasterExternalId || !cancelled.originalStartAt) {
    summary.skipped++;
    return;
  }

  const master = getExternalLinkByProviderId(
    db,
    userId,
    EXTERNAL_LINK_PROVIDER.googleCalendar,
    cancelled.recurringMasterExternalId,
  );
  const masterTask = master ? getTask(db, master.taskId) : undefined;
  if (!masterTask || masterTask.userId !== userId) {
    summary.skipped++;
    return;
  }

  if (addMasterExdate(db, masterTask, cancelled.originalStartAt)) {
    summary.cancelled++;
  } else {
    summary.skipped++;
  }
}

function applyMappedEvents(
  db: Db,
  userId: number,
  source: SyncSource,
  mappedEvents: GoogleCalendarMappedEvent[],
  syncTime: string,
  summary: GoogleCalendarPullSummary,
): void {
  const ordered = [
    ...mappedEvents.filter((event) => !event.recurringMasterExternalId),
    ...mappedEvents.filter((event) => event.recurringMasterExternalId),
  ];
  for (const event of ordered) {
    applyMappedEvent(db, userId, source, event, syncTime, summary);
  }
}

function addSourceCounts(
  summary: GoogleCalendarPullSummary,
  sourceCounts: GoogleCalendarPullSummary,
): void {
  summary.seen += sourceCounts.seen;
  summary.created += sourceCounts.created;
  summary.updated += sourceCounts.updated;
  summary.cancelled += sourceCounts.cancelled;
  summary.skipped += sourceCounts.skipped;
  summary.duplicateSkipped += sourceCounts.duplicateSkipped;
  summary.fullResyncs += sourceCounts.fullResyncs;
  summary.errors.push(...sourceCounts.errors);
}

export async function pullGoogleCalendar(
  db: Db,
  userId: number,
): Promise<GoogleCalendarPullSummary> {
  let metadata = metadataFor(db, userId);
  const summary = emptySummary();
  const syncTime = new Date().toISOString();
  const accessToken = await getGoogleAccessToken(db, userId);
  const sources = selectedCalendarSources(db, userId);
  summary.sources = sources.length;

  for (const source of sources) {
    const sourceCounts = emptySummary();
    sourceCounts.sources = 1;

    try {
      const { events, nextSyncToken, fullResync } = await fetchEventsForSource(
        accessToken,
        source,
      );
      if (fullResync) {
        sourceCounts.fullResyncs++;
      }
      sourceCounts.seen = events.length;

      const mapped = mapGoogleCalendarEvents(sourceSummary(source), events, {
        existingICalUIDs: existingICalUIDs(db, userId),
      });
      sourceCounts.duplicateSkipped += mapped.duplicateSkipped;
      for (const error of mapped.errors) {
        sourceCounts.errors.push(error);
      }

      db.transaction((tx) => {
        const txDb = tx as Db;
        applyMappedEvents(
          txDb,
          userId,
          source,
          mapped.events,
          syncTime,
          sourceCounts,
        );
        for (const cancelled of mapped.cancelledEvents) {
          applyCancelledEvent(
            txDb,
            userId,
            source,
            cancelled,
            syncTime,
            sourceCounts,
          );
        }
      });

      addSourceCounts(summary, sourceCounts);
      updateSyncSource(db, source.id, {
        syncCursor: fullResync
          ? (nextSyncToken ?? null)
          : (nextSyncToken ?? source.syncCursor ?? null),
        lastSyncedAt: syncTime,
        lastResult: {
          seen: sourceCounts.seen,
          created: sourceCounts.created,
          updated: sourceCounts.updated,
          cancelled: sourceCounts.cancelled,
          skipped: sourceCounts.skipped,
          duplicateSkipped: sourceCounts.duplicateSkipped,
          fullResync: fullResync,
        },
        lastError: mapped.errors.length > 0 ? mapped.errors.join("; ") : null,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Google Calendar pull failed for ${source.title}`;
      summary.errors.push(message);
      updateSyncSource(db, source.id, { lastError: message });
    }
  }

  metadata = metadataFor(db, userId);
  saveMetadata(db, userId, {
    ...metadata,
    calendar: {
      ...(metadata.calendar ?? {}),
      lastPulledAt: syncTime,
      lastError:
        summary.errors.length > 0 ? summary.errors.join("; ") : undefined,
      lastResult: summary,
    },
  });

  return summary;
}
