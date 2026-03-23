import { eq } from "drizzle-orm";
import { userSettings } from "@/db/schema";
import type { Db } from "./types";

export interface UrgencyWeights {
  priority: number;
  due: number;
  age: number;
  wip: number;
  blocking: number;
}

export type ViewType = "queue" | "list" | "kanban" | "calendar";
export type DateFormat = "us" | "iso" | "eu";
export type WeekStartDay = 0 | 1;

export interface UserSettings {
  defaultCategory: string;
  defaultView: ViewType;
  weekStartDay: WeekStartDay;
  dateFormat: DateFormat;
  showCompletedTasks: boolean;
  urgencyWeights: UrgencyWeights;
}

export const DEFAULT_SETTINGS: UserSettings = {
  defaultCategory: "Todo",
  defaultView: "list",
  weekStartDay: 1,
  dateFormat: "us",
  showCompletedTasks: true,
  urgencyWeights: {
    priority: 6,
    due: 12,
    age: 2,
    wip: 4,
    blocking: 8,
  },
};

export function getSettings(db: Db, userId: number): UserSettings {
  const row = db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .get();

  if (!row) return { ...DEFAULT_SETTINGS };

  const stored = JSON.parse(row.settings) as Partial<UserSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    urgencyWeights: {
      ...DEFAULT_SETTINGS.urgencyWeights,
      ...(stored.urgencyWeights ?? {}),
    },
  };
}

export function updateSettings(
  db: Db,
  userId: number,
  partial: Partial<UserSettings>,
): UserSettings {
  const current = getSettings(db, userId);

  const merged: UserSettings = {
    ...current,
    ...partial,
    urgencyWeights: {
      ...current.urgencyWeights,
      ...(partial.urgencyWeights ?? {}),
    },
  };

  db.insert(userSettings)
    .values({
      userId,
      settings: JSON.stringify(merged),
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { settings: JSON.stringify(merged) },
    })
    .run();

  return merged;
}
