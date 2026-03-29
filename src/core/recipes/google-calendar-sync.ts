import { syncGoogleCalendar } from "@/core/google-calendar-sync";
import type { Db } from "@/core/types";

export async function googleCalendarSyncHandler(
  db: Db,
  userId: number,
  _config: unknown,
): Promise<void> {
  await syncGoogleCalendar(db, userId);
}
