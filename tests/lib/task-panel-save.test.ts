import { describe, expect, it } from "vitest";
import {
  buildTaskPanelUpdateInput,
  createTaskPanelSaveQueue,
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

  it("serializes queued saves in enqueue order", async () => {
    const queue = createTaskPanelSaveQueue();
    const events: string[] = [];
    let releaseFirst: () => void = () => {
      throw new Error("first save did not start");
    };

    const first = queue.enqueue(
      () =>
        new Promise<boolean>((resolve) => {
          events.push("first:start");
          releaseFirst = () => {
            events.push("first:end");
            resolve(true);
          };
        }),
    );
    const second = queue.enqueue(async () => {
      events.push("second");
      return true;
    });

    await Promise.resolve();

    expect(events).toEqual(["first:start"]);
    releaseFirst();
    await Promise.all([first, second]);

    expect(events).toEqual(["first:start", "first:end", "second"]);
  });

  it("continues the save queue after a rejected save", async () => {
    const queue = createTaskPanelSaveQueue();
    const events: string[] = [];

    const failed = queue.enqueue(async () => {
      events.push("failed");
      throw new Error("boom");
    });
    const next = queue.enqueue(async () => {
      events.push("next");
      return true;
    });

    await expect(failed).rejects.toThrow("boom");
    await expect(next).resolves.toBe(true);
    expect(events).toEqual(["failed", "next"]);
  });
});
