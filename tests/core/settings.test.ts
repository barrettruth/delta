import { beforeEach, describe, expect, it } from "vitest";
import { createUser } from "@/core/auth";
import { DEFAULT_SETTINGS, getSettings, updateSettings } from "@/core/settings";
import type { Db } from "@/core/types";
import { createTestDb } from "../helpers";

let db: Db;
let userId: number;

beforeEach(() => {
  db = createTestDb();
  const user = createUser(db, "testuser", "password123");
  userId = user.id;
});

describe("getSettings", () => {
  it("returns defaults when no settings exist", () => {
    const settings = getSettings(db, userId);
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("returns defaults for a nonexistent user id", () => {
    const settings = getSettings(db, 999);
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe("updateSettings", () => {
  it("persists and returns merged settings", () => {
    const updated = updateSettings(db, userId, { defaultCategory: "Work" });
    expect(updated.defaultCategory).toBe("Work");
    expect(updated.defaultView).toBe("list");
    expect(updated.urgencyWeights).toEqual(DEFAULT_SETTINGS.urgencyWeights);

    const fetched = getSettings(db, userId);
    expect(fetched.defaultCategory).toBe("Work");
  });

  it("updates a single field without losing others", () => {
    updateSettings(db, userId, { defaultCategory: "Work" });
    const updated = updateSettings(db, userId, { defaultView: "kanban" });
    expect(updated.defaultCategory).toBe("Work");
    expect(updated.defaultView).toBe("kanban");
  });

  it("updates urgency weights partially", () => {
    const updated = updateSettings(db, userId, {
      urgencyWeights: { ...DEFAULT_SETTINGS.urgencyWeights, priority: 10 },
    });
    expect(updated.urgencyWeights.priority).toBe(10);
    expect(updated.urgencyWeights.due).toBe(12);
    expect(updated.urgencyWeights.age).toBe(2);
    expect(updated.urgencyWeights.wip).toBe(4);
    expect(updated.urgencyWeights.blocking).toBe(8);
  });

  it("handles upsert on repeated updates", () => {
    updateSettings(db, userId, { defaultCategory: "First" });
    updateSettings(db, userId, { defaultCategory: "Second" });
    const settings = getSettings(db, userId);
    expect(settings.defaultCategory).toBe("Second");
  });

  it("stores boolean settings correctly", () => {
    const updated = updateSettings(db, userId, {
      showCompletedTasks: false,
    });
    expect(updated.showCompletedTasks).toBe(false);

    const fetched = getSettings(db, userId);
    expect(fetched.showCompletedTasks).toBe(false);
  });

  it("stores weekStartDay correctly", () => {
    const updated = updateSettings(db, userId, { weekStartDay: 0 });
    expect(updated.weekStartDay).toBe(0);

    const fetched = getSettings(db, userId);
    expect(fetched.weekStartDay).toBe(0);
  });

  it("stores dateFormat correctly", () => {
    const updated = updateSettings(db, userId, { dateFormat: "iso" });
    expect(updated.dateFormat).toBe("iso");

    const fetched = getSettings(db, userId);
    expect(fetched.dateFormat).toBe("iso");
  });

  it("replaces all urgency weights at once", () => {
    const customWeights = {
      priority: 1,
      due: 2,
      age: 3,
      wip: 5,
      blocking: 10,
    };
    const updated = updateSettings(db, userId, {
      urgencyWeights: customWeights,
    });
    expect(updated.urgencyWeights).toEqual(customWeights);
  });

  it("preserves defaults for missing urgency weight keys in stored JSON", () => {
    updateSettings(db, userId, {
      urgencyWeights: { ...DEFAULT_SETTINGS.urgencyWeights, priority: 99 },
    });
    const fetched = getSettings(db, userId);
    expect(fetched.urgencyWeights.priority).toBe(99);
    expect(fetched.urgencyWeights.due).toBe(
      DEFAULT_SETTINGS.urgencyWeights.due,
    );
  });
});
