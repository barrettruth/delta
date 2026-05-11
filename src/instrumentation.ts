export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/core/automation");
    const { db } = await import("@/db");
    await startScheduler(db);
  }
}
