import { type ScheduledTask, schedule } from "node-cron";
import type { Db } from "../types";
import { enqueueDueReminderDeliveries } from "./deliveries";
import type { ReminderDelivery } from "./types";

export const REMINDER_WORKER_CRON = "* * * * *";
export const DEFAULT_REMINDER_TIMEZONE = "UTC";

export interface ReminderWorkerRunResult {
  nowIso: string;
  enqueued: ReminderDelivery[];
}

let reminderJob: ScheduledTask | null = null;

export function runReminderWorker(
  db: Db,
  input: {
    nowIso?: string;
    userTimezoneResolver?: (userId: number) => string;
  } = {},
): ReminderWorkerRunResult {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const userTimezoneResolver =
    input.userTimezoneResolver ?? (() => DEFAULT_REMINDER_TIMEZONE);

  return {
    nowIso,
    enqueued: enqueueDueReminderDeliveries(db, {
      nowIso,
      userTimezoneResolver,
    }),
  };
}

export function startReminderWorker(db: Db): () => void {
  stopReminderWorker();

  reminderJob = schedule(REMINDER_WORKER_CRON, async () => {
    try {
      runReminderWorker(db);
    } catch {}
  });

  return stopReminderWorker;
}

export function stopReminderWorker(): void {
  if (!reminderJob) return;

  reminderJob.stop();
  reminderJob = null;
}
