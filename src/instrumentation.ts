export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/core/automation");
    const { startReminderWorker } = await import("@/core/reminders/worker");
    const { db } = await import("@/db");
    await startScheduler(db);
    startReminderWorker(db);
  }
}
