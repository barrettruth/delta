import { type ScheduledTask, schedule } from "node-cron";
import type { Db } from "../types";
import { enqueueDueReminderDeliveries } from "./deliveries";
import { dispatchDueReminderDeliveries } from "./dispatch";
import type { ReminderDelivery } from "./types";

export const REMINDER_WORKER_CRON = "* * * * *";
export const DEFAULT_REMINDER_TIMEZONE = "UTC";

export interface ReminderWorkerRunResult {
  nowIso: string;
  enqueued: ReminderDelivery[];
  dispatched: ReminderDelivery[];
}

let reminderJob: ScheduledTask | null = null;

export async function runReminderWorker(
  db: Db,
  input: {
    nowIso?: string;
    userTimezoneResolver?: (userId: number) => string;
  } = {},
): Promise<ReminderWorkerRunResult> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const userTimezoneResolver =
    input.userTimezoneResolver ?? (() => DEFAULT_REMINDER_TIMEZONE);
  const enqueued = enqueueDueReminderDeliveries(db, {
    nowIso,
    userTimezoneResolver,
  });
  const dispatched = await dispatchDueReminderDeliveries(db, { nowIso });

  return {
    nowIso,
    enqueued,
    dispatched,
  };
}

export function startReminderWorker(db: Db): () => void {
  stopReminderWorker();

  reminderJob = schedule(REMINDER_WORKER_CRON, async () => {
    try {
      await runReminderWorker(db);
    } catch {}
  });

  return stopReminderWorker;
}

export function stopReminderWorker(): void {
  if (!reminderJob) return;

  reminderJob.stop();
  reminderJob = null;
}
