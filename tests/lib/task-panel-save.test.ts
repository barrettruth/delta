import { describe, expect, it } from "vitest";
import {
  buildTaskPanelUpdateInput,
  isTaskPanelDirty,
  mergeSavedReminderDrafts,
} from "@/lib/task-panel-save";

describe("task panel save helpers", () => {
  it("omits due when the user has not changed it", () => {
    const input = buildTaskPanelUpdateInput(
      {
        description: "  Write tests  ",
        category: "Work",
        due: "2026-04-24T09:30",
        location: "  Home office  ",
        locationLat: 40,
        locationLon: -73,
        meetingUrl: "  https://meet.example/test  ",
        recurrence: null,
        recurMode: "scheduled",
        notes: null,
      },
      "2026-04-24T09:30",
    );

    expect(input).toEqual({
      description: "Write tests",
      category: "Work",
      notes: null,
      location: "Home office",
      locationLat: 40,
      locationLon: -73,
      meetingUrl: "https://meet.example/test",
      recurrence: null,
      recurMode: null,
    });
  });

  it("treats trimmed text changes as already saved", () => {
    const dirty = isTaskPanelDirty(
      {
        description: "Write tests",
        category: "Work",
        due: "2026-04-24T09:30",
        location: "Desk",
        locationLat: null,
        locationLon: null,
        meetingUrl: "",
        recurrence: null,
        recurMode: "scheduled",
        notes: null,
      },
      {
        description: "  Write tests  ",
        category: "Work",
        due: "2026-04-24T09:30",
        location: "  Desk  ",
        locationLat: null,
        locationLon: null,
        meetingUrl: "   ",
        recurrence: null,
        recurMode: "scheduled",
        notes: null,
      },
      null,
      null,
    );

    expect(dirty).toBe(false);
  });

  it("preserves client ids when mapping saved reminders back into drafts", () => {
    const drafts = [
      {
        clientId: "draft-1",
        id: null,
        endpointId: 3,
        anchor: "due" as const,
        offsetMinutes: -15,
        allDayLocalTime: null,
        enabled: 1 as const,
      },
    ];

    const merged = mergeSavedReminderDrafts(drafts, [
      {
        id: 8,
        userId: 1,
        taskId: 2,
        endpointId: 3,
        anchor: "due",
        offsetMinutes: -15,
        allDayLocalTime: null,
        enabled: 1,
        createdAt: "2026-04-24T00:00:00.000Z",
        updatedAt: "2026-04-24T00:00:00.000Z",
      },
    ]);

    expect(merged).toEqual([
      {
        clientId: "draft-1",
        id: 8,
        endpointId: 3,
        anchor: "due",
        offsetMinutes: -15,
        allDayLocalTime: null,
        enabled: 1,
      },
    ]);
  });
});
