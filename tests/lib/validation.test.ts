import { describe, expect, it } from "vitest";
import { validateCreateTask, validateUpdateTask } from "@/lib/validation";

describe("validateCreateTask", () => {
  it("accepts a valid task", () => {
    const result = validateCreateTask({
      description: "Buy groceries",
      status: "pending",
      due: "2026-04-01T09:00:00.000Z",
    });
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe("Buy groceries");
  });

  it("accepts minimal valid task", () => {
    const result = validateCreateTask({ description: "Test" });
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe("Test");
  });

  it("rejects missing description", () => {
    const result = validateCreateTask({ status: "pending" });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.field === "description")).toBe(true);
  });

  it("rejects empty description", () => {
    const result = validateCreateTask({ description: "" });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.field === "description")).toBe(true);
  });

  it("rejects non-string description", () => {
    const result = validateCreateTask({ description: 123 });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.field === "description")).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = validateCreateTask({
      description: "Test",
      status: "invalid",
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.field === "status")).toBe(true);
  });

  it("rejects invalid due date", () => {
    const result = validateCreateTask({
      description: "Test",
      due: "not-a-date",
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.field === "due")).toBe(true);
  });

  it("accepts null due date", () => {
    const result = validateCreateTask({
      description: "Test",
      due: null,
    });
    expect(result.success).toBe(true);
    expect(result.data?.due).toBeUndefined();
  });

  it("normalizes the shared task detail fields", () => {
    const result = validateCreateTask({
      description: "  <b>Planning</b>  ",
      due: "2026-04-01",
      startAt: "2026-04-01T09:00:00.000Z",
      endAt: "2026-04-01T10:00:00.000Z",
      allDay: 0,
      timezone: "America/New_York",
      recurrence: "FREQ=WEEKLY",
      recurMode: "scheduled",
      notes: "<p>Bring notes</p>",
      location: "  <i>Office</i>  ",
      locationLat: 40.7128,
      locationLon: -74.006,
      meetingUrl: "  https://meet.example/planning  ",
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      description: "Planning",
      due: "2026-04-01",
      startAt: "2026-04-01T09:00:00.000Z",
      endAt: "2026-04-01T10:00:00.000Z",
      allDay: 0,
      timezone: "America/New_York",
      recurrence: "FREQ=WEEKLY",
      recurMode: "scheduled",
      notes: "Bring notes",
      location: "Office",
      locationLat: 40.7128,
      locationLon: -74.006,
      meetingUrl: "https://meet.example/planning",
    });
  });

  it("rejects date-only scheduled start and end fields", () => {
    const result = validateCreateTask({
      description: "Event",
      startAt: "2026-04-01",
      endAt: "2026-04-02",
    });

    expect(result.success).toBe(false);
    expect(result.errors?.map((e) => e.field)).toEqual(["startAt", "endAt"]);
  });

  it("rejects invalid recurrence mode and non-string recurrence", () => {
    const result = validateCreateTask({
      description: "Recurring",
      due: "2026-04-01T09:00:00.000Z",
      recurrence: 1,
      recurMode: "manual",
    });

    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.field === "recurrence")).toBe(true);
    expect(result.errors?.some((e) => e.field === "recurMode")).toBe(true);
  });

  it("sanitizes description with HTML", () => {
    const result = validateCreateTask({
      description: "<b>Bold task</b>",
    });
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe("Bold task");
  });

  it("sanitizes notes with HTML", () => {
    const result = validateCreateTask({
      description: "Task",
      notes: "<script>alert('xss')</script>some notes",
    });
    expect(result.success).toBe(true);
    expect(result.data?.notes).toBe("alert('xss')some notes");
  });

  it("rejects non-object body", () => {
    const result = validateCreateTask("not an object");
    expect(result.success).toBe(false);
  });

  it("rejects null body", () => {
    const result = validateCreateTask(null);
    expect(result.success).toBe(false);
  });

  it("reports multiple errors at once", () => {
    const result = validateCreateTask({
      description: "",
      status: "invalid",
    });
    expect(result.success).toBe(false);
    expect(result.errors?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("validateUpdateTask", () => {
  it("accepts a valid partial update", () => {
    const result = validateUpdateTask({
      description: "Updated",
    });
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe("Updated");
  });

  it("accepts empty object", () => {
    const result = validateUpdateTask({});
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = validateUpdateTask({ status: "bad" });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.field === "status")).toBe(true);
  });

  it("rejects null description updates", () => {
    const result = validateUpdateTask({ description: null });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.field === "description")).toBe(true);
  });

  it("accepts null due date", () => {
    const result = validateUpdateTask({ due: null });
    expect(result.success).toBe(true);
    expect(result.data?.due).toBeNull();
  });

  it("accepts date-only due updates", () => {
    const result = validateUpdateTask({ due: "2026-04-01" });
    expect(result.success).toBe(true);
    expect(result.data?.due).toBe("2026-04-01");
  });

  it("normalizes nullable task detail clears", () => {
    const result = validateUpdateTask({
      category: null,
      recurrence: null,
      recurMode: null,
      notes: null,
      location: null,
      locationLat: null,
      locationLon: null,
      meetingUrl: null,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      category: null,
      recurrence: null,
      recurMode: null,
      notes: null,
      location: null,
      locationLat: null,
      locationLon: null,
      meetingUrl: null,
    });
  });

  it("sanitizes description on update", () => {
    const result = validateUpdateTask({
      description: "<img src=x onerror=alert(1)>real text",
    });
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe("real text");
  });

  it("rejects non-object body", () => {
    const result = validateUpdateTask(42);
    expect(result.success).toBe(false);
  });
});
