import { describe, expect, it } from "vitest";
import {
  buildReminderOffsetMinutes,
  createTaskPanelReminderDraft,
  formatTaskPanelReminderSummary,
  getReminderOffsetDirection,
  getReminderOffsetMagnitude,
  taskPanelRemindersEqual,
  taskReminderToDraft,
} from "@/lib/task-panel-reminders";

const endpoints = new Map([
  [1, { id: 1, adapterKey: "sms.twilio" as const, label: "personal sms" }],
  [
    2,
    {
      id: 2,
      adapterKey: "telegram.bot_api" as const,
      label: "telegram",
    },
  ],
]);

describe("task panel reminder helpers", () => {
  it("creates timed reminder drafts with a default pre-send offset", () => {
    expect(
      createTaskPanelReminderDraft("draft-1", {
        endpointId: 1,
        anchor: "due",
        allDay: false,
      }),
    ).toEqual({
      clientId: "draft-1",
      id: null,
      endpointId: 1,
      anchor: "due",
      offsetMinutes: -15,
      allDayLocalTime: null,
      enabled: 1,
    });
  });

  it("creates all-day reminder drafts with a local reminder time", () => {
    expect(
      createTaskPanelReminderDraft("draft-2", {
        endpointId: 2,
        anchor: "start",
        allDay: true,
      }),
    ).toEqual({
      clientId: "draft-2",
      id: null,
      endpointId: 2,
      anchor: "start",
      offsetMinutes: 0,
      allDayLocalTime: "09:00",
      enabled: 1,
    });
  });

  it("round-trips reminder offset direction and magnitude", () => {
    expect(getReminderOffsetDirection(-90)).toBe("before");
    expect(getReminderOffsetMagnitude(-90)).toBe(90);
    expect(buildReminderOffsetMinutes("before", 90)).toBe(-90);
    expect(buildReminderOffsetMinutes("after", 120)).toBe(120);
    expect(buildReminderOffsetMinutes("at", 45)).toBe(0);
  });

  it("formats timed reminder summaries", () => {
    expect(
      formatTaskPanelReminderSummary(
        {
          endpointId: 1,
          anchor: "due",
          offsetMinutes: -90,
          allDayLocalTime: null,
        },
        endpoints,
        { allDay: false },
      ),
    ).toBe("1h 30m before due → SMS");
  });

  it("formats all-day reminder summaries with a local time", () => {
    expect(
      formatTaskPanelReminderSummary(
        {
          endpointId: 2,
          anchor: "due",
          offsetMinutes: 0,
          allDayLocalTime: "09:00",
        },
        endpoints,
        { allDay: true },
      ),
    ).toBe("09:00 on due day → Telegram");
  });

  it("compares reminder drafts by persisted fields", () => {
    const draft = taskReminderToDraft(
      {
        id: 3,
        endpointId: 1,
        anchor: "due",
        offsetMinutes: -15,
        allDayLocalTime: null,
        enabled: 1,
      },
      "draft-3",
    );

    expect(
      taskPanelRemindersEqual(
        {
          id: draft.id,
          endpointId: draft.endpointId,
          anchor: draft.anchor,
          offsetMinutes: draft.offsetMinutes,
          allDayLocalTime: draft.allDayLocalTime,
          enabled: draft.enabled,
        },
        {
          id: 3,
          endpointId: 1,
          anchor: "due",
          offsetMinutes: -15,
          allDayLocalTime: null,
          enabled: 1,
        },
      ),
    ).toBe(true);
  });
});
