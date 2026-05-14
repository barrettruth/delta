import { listCategoryColors, setCategoryColor } from "@/core/categories";
import {
  getSyncSource,
  listSyncSources,
  SYNC_SOURCE_KIND,
  type SyncSource,
  updateSyncSource,
  upsertSyncSource,
} from "@/core/sync-sources";
import type { Db } from "@/core/types";
import {
  GOOGLE_PROVIDER,
  type GoogleCalendarListEntry,
  type GoogleCalendarSourceSummary,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMetadata(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function calendarTitle(calendar: GoogleCalendarListEntry): string {
  return (
    calendar.summaryOverride?.trim() || calendar.summary?.trim() || calendar.id
  );
}

function hasEventDetailAccess(calendar: GoogleCalendarListEntry): boolean {
  return (
    calendar.accessRole !== "freeBusyReader" && calendar.accessRole !== "none"
  );
}

function metadataFor(
  calendar: GoogleCalendarListEntry,
  selected: boolean,
): Record<string, unknown> {
  return {
    calendarId: calendar.id,
    summary: calendar.summary ?? null,
    summaryOverride: calendar.summaryOverride ?? null,
    description: calendar.description ?? null,
    primary: calendar.primary === true,
    hidden: calendar.hidden === true,
    selected,
    googleSelected: calendar.selected === true,
    accessRole: calendar.accessRole ?? null,
    timeZone: calendar.timeZone ?? null,
    colorId: calendar.colorId ?? null,
    backgroundColor: calendar.backgroundColor ?? null,
    foregroundColor: calendar.foregroundColor ?? null,
  };
}

function sourceSummary(source: SyncSource): GoogleCalendarSourceSummary {
  const metadata = parseMetadata(source.metadata);
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

function seedCategoryColor(
  db: Db,
  userId: number,
  category: string,
  color: string | undefined,
  categoryColors: Record<string, string>,
): void {
  if (!color || categoryColors[category]) return;
  setCategoryColor(db, userId, category, color);
  categoryColors[category] = color;
}

export function listGoogleCalendarSources(
  db: Db,
  userId: number,
): GoogleCalendarSourceSummary[] {
  return listSyncSources(db, userId, {
    provider: GOOGLE_PROVIDER,
    sourceKind: SYNC_SOURCE_KIND.googleCalendar,
  })
    .map(sourceSummary)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function syncGoogleCalendarSources(
  db: Db,
  userId: number,
  calendars: GoogleCalendarListEntry[],
): GoogleCalendarSourceSummary[] {
  const syncableCalendars = calendars.filter(hasEventDetailAccess);
  const categoryColors = listCategoryColors(db, userId);
  const existingSources = new Map(
    listSyncSources(db, userId, {
      provider: GOOGLE_PROVIDER,
      sourceKind: SYNC_SOURCE_KIND.googleCalendar,
    }).map((source) => [source.sourceId, source]),
  );

  for (const calendar of syncableCalendars) {
    const title = calendarTitle(calendar);
    const existing = existingSources.get(calendar.id);
    const enabled = existing?.enabled ?? (calendar.hidden === true ? 0 : 1);
    const defaultCategory = existing?.defaultCategory ?? title;

    upsertSyncSource(db, {
      userId,
      provider: GOOGLE_PROVIDER,
      sourceKind: SYNC_SOURCE_KIND.googleCalendar,
      sourceId: calendar.id,
      title,
      enabled,
      readOnly: 1,
      defaultCategory,
      metadata: metadataFor(calendar, enabled === 1),
    });
    if (enabled === 1) {
      seedCategoryColor(
        db,
        userId,
        defaultCategory,
        calendar.backgroundColor,
        categoryColors,
      );
    }
  }

  return listGoogleCalendarSources(db, userId);
}

export function setGoogleCalendarSourceEnabled(
  db: Db,
  userId: number,
  sourceId: number,
  enabled: boolean,
): GoogleCalendarSourceSummary | null {
  const source = getSyncSource(db, sourceId);
  if (
    !source ||
    source.userId !== userId ||
    source.provider !== GOOGLE_PROVIDER ||
    source.sourceKind !== SYNC_SOURCE_KIND.googleCalendar
  ) {
    return null;
  }

  const metadata = parseMetadata(source.metadata);
  metadata.selected = enabled;
  if (enabled) {
    seedCategoryColor(
      db,
      userId,
      source.defaultCategory ?? source.title,
      typeof metadata.backgroundColor === "string"
        ? metadata.backgroundColor
        : undefined,
      listCategoryColors(db, userId),
    );
  }
  return sourceSummary(
    updateSyncSource(db, source.id, {
      enabled: enabled ? 1 : 0,
      metadata,
    }),
  );
}
