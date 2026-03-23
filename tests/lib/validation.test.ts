import { describe, expect, it } from "vitest";
import {
  sanitize,
  validateCreateTask,
  validateUpdateTask,
} from "@/lib/validation";

describe("sanitize", () => {
  it("strips HTML tags", () => {
    expect(sanitize("<script>alert('xss')</script>")).toBe("alert('xss')");
  });

  it("strips nested HTML", () => {
    expect(sanitize("<b><i>text</i></b>")).toBe("text");
  });

  it("leaves plain text alone", () => {
    expect(sanitize("hello world")).toBe("hello world");
  });

  it("handles empty string", () => {
    expect(sanitize("")).toBe("");
  });

  it("strips self-closing tags", () => {
    expect(sanitize("before<br/>after")).toBe("beforeafter");
  });

  it("strips deeply nested HTML tags", () => {
    expect(sanitize("<div><span><b><i>deep</i></b></span></div>")).toBe("deep");
  });

  it("strips script tags with attributes", () => {
    expect(sanitize('<script type="text/javascript">evil()</script>')).toBe(
      "evil()",
    );
  });

  it("strips tags with event handlers", () => {
    expect(sanitize('<img src="x" onerror="alert(1)">')).toBe("");
  });

  it("preserves HTML entities", () => {
    expect(sanitize("5 &gt; 3 &amp; 2 &lt; 4")).toBe("5 &gt; 3 &amp; 2 &lt; 4");
  });

  it("strips incomplete/malformed tags", () => {
    expect(sanitize("text<br>more<hr>end")).toBe("textmoreend");
  });
});

describe("validateCreateTask", () => {
  it("accepts a valid task", () => {
    const result = validateCreateTask({
      description: "Buy groceries",
      status: "pending",
      priority: 2,
      due: "2026-04-01T09:00:00.000Z",
    });
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe("Buy groceries");
    expect(result.data?.priority).toBe(2);
  });

  it("accepts minimal valid task", () => {
    const result = validateCreateTask({ description: "Test" });
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe("Test");
  });

  it("rejects missing description", () => {
    const result = validateCreateTask({ priority: 1 });
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

  it("rejects priority out of range", () => {
    const result = validateCreateTask({
      description: "Test",
      priority: 5,
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.field === "priority")).toBe(true);
  });

  it("rejects negative priority", () => {
    const result = validateCreateTask({
      description: "Test",
      priority: -1,
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.field === "priority")).toBe(true);
  });

  it("rejects non-integer priority", () => {
    const result = validateCreateTask({
      description: "Test",
      priority: 1.5,
    });
    expect(result.success).toBe(false);
    expect(result.errors?.some((e) => e.field === "priority")).toBe(true);
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
      priority: 10,
    });
    expect(result.success).toBe(false);
    expect(result.errors?.length).toBeGreaterThanOrEqual(3);
  });
});

describe("validateUpdateTask", () => {
  it("accepts a valid partial update", () => {
    const result = validateUpdateTask({
      description: "Updated",
      priority: 1,
    });
    expect(result.success).toBe(true);
    expect(result.data?.description).toBe("Updated");
    expect(result.data?.priority).toBe(1);
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

  it("rejects priority out of range", () => {
    const result = validateUpdateTask({ priority: 4 });
    expect(result.success).toBe(false);
  });

  it("accepts null due date", () => {
    const result = validateUpdateTask({ due: null });
    expect(result.success).toBe(true);
    expect(result.data?.due).toBeNull();
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
