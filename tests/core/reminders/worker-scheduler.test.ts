import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../../helpers";

const cron = vi.hoisted(() => ({
  firstJob: { stop: vi.fn() },
  secondJob: { stop: vi.fn() },
  schedule: vi.fn(),
}));

vi.mock("node-cron", () => ({
  schedule: cron.schedule,
}));

beforeEach(() => {
  vi.resetModules();
  cron.firstJob.stop.mockReset();
  cron.secondJob.stop.mockReset();
  cron.schedule.mockReset();
  cron.schedule
    .mockReturnValueOnce(cron.firstJob)
    .mockReturnValueOnce(cron.secondJob);
});

describe("startReminderWorker", () => {
  it("schedules a minute job and stops the previous worker before restarting", async () => {
    const db = createTestDb();
    const { startReminderWorker, stopReminderWorker } = await import(
      "@/core/reminders/worker"
    );

    startReminderWorker(db);
    expect(cron.schedule).toHaveBeenCalledWith(
      "* * * * *",
      expect.any(Function),
    );

    startReminderWorker(db);
    expect(cron.firstJob.stop).toHaveBeenCalledOnce();

    stopReminderWorker();
    expect(cron.secondJob.stop).toHaveBeenCalledOnce();
  });
});
