import { describe, expect, it } from "vitest";
import {
  buildTaskPanelUpdateInput,
  isTaskPanelDirty,
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
    );

    expect(dirty).toBe(false);
  });

  it("uses the shared update parser for save validation", () => {
    expect(() =>
      buildTaskPanelUpdateInput(
        {
          description: "Write tests",
          category: "Work",
          due: "2026-04-24T09:30",
          location: "Desk",
          locationLat: null,
          locationLon: null,
          meetingUrl: "meet.example/test",
          recurrence: null,
          recurMode: "scheduled",
          notes: null,
        },
        "2026-04-24T09:30",
      ),
    ).toThrow("meetingUrl must be a valid URL");
  });
});
