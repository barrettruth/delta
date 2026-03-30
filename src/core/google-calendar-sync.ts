import { and, eq, gt, isNotNull } from "drizzle-orm";
import { tasks } from "@/db/schema";
import {
  createCalendar,
  createCalendarEvent,
  deleteCalendarEvent,
  getGoogleAccessToken,
  listCalendarEvents,
  updateCalendarEvent,
} from "./google-calendar";
import {
  googleEventToTaskInput,
  taskToGoogleEvent,
} from "./google-calendar-mapper";
import {
  getIntegrationConfig,
  upsertIntegrationConfig,
} from "./integration-config";
import { createTask, updateTask } from "./task";
import type { Db, Task, UpdateTaskInput } from "./types";

interface SyncMetadata {
  syncToken?: string;
  lastSyncTime?: string;
  calendarId?: string;
  [key: string]: unknown;
}

function getMetadata(
  db: Db,
  userId: number,
): { metadata: SyncMetadata; tokens: Record<string, unknown> } | null {
  const config = getIntegrationConfig(db, userId, "google_calendar");
  if (!config || config.enabled !== 1) return null;

  return {
    metadata: (config.metadata ?? {}) as SyncMetadata,
    tokens: config.tokens,
  };
}

function saveMetadata(
  db: Db,
  userId: number,
  metadata: SyncMetadata,
  tokens: Record<string, unknown>,
): void {
  upsertIntegrationConfig(db, userId, "google_calendar", tokens, metadata);
}

function findTaskByExternalId(
  db: Db,
  userId: number,
  externalId: string,
): Task | undefined {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.externalId, externalId)))
    .get();
}

function getTrackedFields(
  input: Partial<Record<string, unknown>>,
): Partial<UpdateTaskInput> {
  const tracked: Partial<UpdateTaskInput> = {};
  const fieldKeys = [
    "description",
    "notes",
    "startAt",
    "endAt",
    "allDay",
    "timezone",
    "location",
    "meetingUrl",
    "recurrence",
    "status",
  ] as const;

  for (const key of fieldKeys) {
    if (key in input && input[key] !== undefined) {
      (tracked as Record<string, unknown>)[key] = input[key];
    }
  }

  return tracked;
}

function mergeFields(
  googleInput: Partial<UpdateTaskInput>,
  existingTask: Task,
  googleUpdated: string | undefined,
): Partial<UpdateTaskInput> {
  const merged: Partial<UpdateTaskInput> = {};
  const googleTime = googleUpdated ? new Date(googleUpdated).getTime() : 0;
  const taskTime = new Date(existingTask.updatedAt).getTime();

  const fieldKeys = [
    "description",
    "notes",
    "startAt",
    "endAt",
    "allDay",
    "timezone",
    "location",
    "meetingUrl",
    "recurrence",
    "status",
  ] as const;

  for (const key of fieldKeys) {
    if (!(key in googleInput)) continue;

    const googleValue = googleInput[key as keyof typeof googleInput];
    const taskValue = existingTask[key as keyof Task];

    if (googleValue === taskValue) continue;

    if (googleTime >= taskTime) {
      (merged as Record<string, unknown>)[key] = googleValue;
    }
  }

  return merged;
}

async function pullEvents(
  db: Db,
  userId: number,
  accessToken: string,
  calendarId: string,
  syncToken?: string,
): Promise<{
  nextSyncToken?: string;
  fullSyncNeeded: boolean;
  pulled: number;
}> {
  const result = await listCalendarEvents(accessToken, calendarId, syncToken);

  if (syncToken && !result.nextSyncToken && result.events.length === 0) {
    return { nextSyncToken: undefined, fullSyncNeeded: true, pulled: 0 };
  }

  let pulled = 0;

  for (const event of result.events) {
    const externalId = `gcal:${event.id}`;
    const existing = findTaskByExternalId(db, userId, externalId);

    if (event.status === "cancelled") {
      if (existing) {
        updateTask(db, existing.id, {
          status: "cancelled",
          externalId: null,
        });
        pulled++;
      }
      continue;
    }

    const input = googleEventToTaskInput(event);

    if (existing) {
      const trackedInput = getTrackedFields(input as Record<string, unknown>);
      const merged = mergeFields(trackedInput, existing, event.updated);

      if (Object.keys(merged).length > 0) {
        updateTask(db, existing.id, merged);
        pulled++;
      }
    } else {
      createTask(db, userId, {
        description: input.description ?? "(No title)",
        ...input,
      });
      pulled++;
    }
  }

  return { nextSyncToken: result.nextSyncToken, fullSyncNeeded: false, pulled };
}

async function pushEvents(
  db: Db,
  userId: number,
  accessToken: string,
  calendarId: string,
  lastSyncTime?: string,
): Promise<number> {
  const conditions = [eq(tasks.userId, userId), isNotNull(tasks.startAt)];

  if (lastSyncTime) {
    conditions.push(gt(tasks.updatedAt, lastSyncTime));
  }

  const modifiedTasks = db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .all();

  let pushed = 0;

  for (const task of modifiedTasks) {
    const gcalId = task.externalId?.startsWith("gcal:")
      ? task.externalId.slice(5)
      : null;

    if (gcalId && task.status === "cancelled") {
      try {
        await deleteCalendarEvent(accessToken, calendarId, gcalId);
        updateTask(db, task.id, { externalId: null });
        pushed++;
      } catch {
        /* keep externalId so we retry next sync */
      }
      continue;
    }

    if (gcalId) {
      const eventBody = taskToGoogleEvent(task);
      try {
        await updateCalendarEvent(accessToken, calendarId, gcalId, eventBody);
        pushed++;
      } catch {
        /* noop */
      }
      continue;
    }

    if (!gcalId && task.status !== "cancelled" && !task.externalSource) {
      const eventBody = taskToGoogleEvent(task);
      try {
        const created = await createCalendarEvent(
          accessToken,
          calendarId,
          eventBody,
        );
        updateTask(db, task.id, { externalId: `gcal:${created.id}` });
        pushed++;
      } catch {
        /* noop */
      }
    }
  }

  return pushed;
}

export async function syncGoogleCalendar(
  db: Db,
  userId: number,
): Promise<{ pulled: number; pushed: number }> {
  const configData = getMetadata(db, userId);
  if (!configData) {
    throw new Error(
      "Google Calendar integration is not configured or disabled",
    );
  }

  const { metadata, tokens } = configData;

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(db, userId);
  } catch (err) {
    throw new Error(
      `Failed to get Google access token: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  let calendarId = metadata.calendarId;
  if (!calendarId) {
    const calendar = await createCalendar(accessToken, "delta");
    calendarId = calendar.id;
    metadata.calendarId = calendarId;
    saveMetadata(db, userId, metadata, tokens);
  }

  let syncToken = metadata.syncToken;
  let totalPulled = 0;

  const pullResult = await pullEvents(
    db,
    userId,
    accessToken,
    calendarId,
    syncToken,
  );

  if (pullResult.fullSyncNeeded) {
    const retryResult = await pullEvents(
      db,
      userId,
      accessToken,
      calendarId,
      undefined,
    );
    syncToken = retryResult.nextSyncToken;
    totalPulled = retryResult.pulled;
  } else {
    syncToken = pullResult.nextSyncToken ?? syncToken;
    totalPulled = pullResult.pulled;
  }

  const pushed = await pushEvents(
    db,
    userId,
    accessToken,
    calendarId,
    metadata.lastSyncTime,
  );

  const now = new Date().toISOString();
  metadata.syncToken = syncToken;
  metadata.lastSyncTime = now;
  saveMetadata(db, userId, metadata, tokens);

  return { pulled: totalPulled, pushed };
}
