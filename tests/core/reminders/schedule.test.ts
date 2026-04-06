import { describe, expect, it } from "vitest";
import {
  resolveReminderBaseTime,
  resolveReminderSendTime,
  shouldSuppressTaskReminders,
} from "@/core/reminders/schedule";

describe("shouldSuppressTaskReminders", () => {
  it("suppresses reminders for done and cancelled tasks", () => {
    expect(shouldSuppressTaskReminders("done")).toBe(true);
    expect(shouldSuppressTaskReminders("cancelled")).toBe(true);
  });

  it("allows reminders for active task states", () => {
    expect(shouldSuppressTaskReminders("pending")).toBe(false);
    expect(shouldSuppressTaskReminders("wip")).toBe(false);
    expect(shouldSuppressTaskReminders("blocked")).toBe(false);
  });
});

describe("resolveReminderBaseTime", () => {
  it("uses due time for timed tasks", () => {
    const base = resolveReminderBaseTime({
      task: {
        due: "2026-04-06T15:30:00.000Z",
        startAt: null,
        allDay: 0,
        timezone: null,
        status: "pending",
      },
      anchor: "due",
      offsetMinutes: 0,
      defaultAllDayLocalTime: "09:00",
      userTimezone: "UTC",
    });

    expect(base?.toISOString()).toBe("2026-04-06T15:30:00.000Z");
  });

  it("uses start time for timed tasks", () => {
    const base = resolveReminderBaseTime({
      task: {
        due: null,
        startAt: "2026-04-06T14:00:00.000Z",
        allDay: 0,
        timezone: null,
        status: "pending",
      },
      anchor: "start",
      offsetMinutes: 0,
      defaultAllDayLocalTime: "09:00",
      userTimezone: "UTC",
    });

    expect(base?.toISOString()).toBe("2026-04-06T14:00:00.000Z");
  });

  it("uses the task timezone for all-day tasks", () => {
    const base = resolveReminderBaseTime({
      task: {
        due: "2026-03-22T00:00:00.000Z",
        startAt: null,
        allDay: 1,
        timezone: "America/Chicago",
        status: "pending",
      },
      anchor: "due",
      offsetMinutes: 0,
      allDayLocalTime: "09:00",
      defaultAllDayLocalTime: "08:00",
      userTimezone: "UTC",
    });

    expect(base?.toISOString()).toBe("2026-03-22T14:00:00.000Z");
  });

  it("falls back to the user timezone for all-day tasks", () => {
    const base = resolveReminderBaseTime({
      task: {
        due: "2026-06-15T00:00:00.000Z",
        startAt: null,
        allDay: 1,
        timezone: null,
        status: "pending",
      },
      anchor: "due",
      offsetMinutes: 0,
      defaultAllDayLocalTime: "09:00",
      userTimezone: "America/New_York",
    });

    expect(base?.toISOString()).toBe("2026-06-15T13:00:00.000Z");
  });

  it("returns null when the anchor does not exist", () => {
    const base = resolveReminderBaseTime({
      task: {
        due: null,
        startAt: null,
        allDay: 0,
        timezone: null,
        status: "pending",
      },
      anchor: "due",
      offsetMinutes: 0,
      defaultAllDayLocalTime: "09:00",
      userTimezone: "UTC",
    });

    expect(base).toBeNull();
  });

  it("returns null for invalid all-day local time", () => {
    const base = resolveReminderBaseTime({
      task: {
        due: "2026-06-15T00:00:00.000Z",
        startAt: null,
        allDay: 1,
        timezone: "UTC",
        status: "pending",
      },
      anchor: "due",
      offsetMinutes: 0,
      allDayLocalTime: "25:00",
      defaultAllDayLocalTime: "09:00",
      userTimezone: "UTC",
    });

    expect(base).toBeNull();
  });
});

describe("resolveReminderSendTime", () => {
  it("applies negative offsets", () => {
    const sendAt = resolveReminderSendTime({
      task: {
        due: "2026-04-06T15:30:00.000Z",
        startAt: null,
        allDay: 0,
        timezone: null,
        status: "pending",
      },
      anchor: "due",
      offsetMinutes: -10,
      defaultAllDayLocalTime: "09:00",
      userTimezone: "UTC",
    });

    expect(sendAt?.toISOString()).toBe("2026-04-06T15:20:00.000Z");
  });

  it("applies positive offsets", () => {
    const sendAt = resolveReminderSendTime({
      task: {
        due: null,
        startAt: "2026-04-06T14:00:00.000Z",
        allDay: 0,
        timezone: null,
        status: "pending",
      },
      anchor: "start",
      offsetMinutes: 60,
      defaultAllDayLocalTime: "09:00",
      userTimezone: "UTC",
    });

    expect(sendAt?.toISOString()).toBe("2026-04-06T15:00:00.000Z");
  });

  it("returns null for suppressed task states", () => {
    const sendAt = resolveReminderSendTime({
      task: {
        due: "2026-04-06T15:30:00.000Z",
        startAt: null,
        allDay: 0,
        timezone: null,
        status: "done",
      },
      anchor: "due",
      offsetMinutes: 0,
      defaultAllDayLocalTime: "09:00",
      userTimezone: "UTC",
    });

    expect(sendAt).toBeNull();
  });
});
