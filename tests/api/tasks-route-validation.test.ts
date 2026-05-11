import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/tasks/[id]/route";
import { POST } from "@/app/api/tasks/route";

const mocks = vi.hoisted(() => ({
  completeTask: vi.fn(),
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  getTask: vi.fn(),
  listTasks: vi.fn(),
  updateTask: vi.fn(),
  deleteAllInstances: vi.fn(),
  deleteThisAndFuture: vi.fn(),
  deleteThisInstance: vi.fn(),
  editAllInstances: vi.fn(),
  editThisAndFuture: vi.fn(),
  editThisInstance: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({}));

vi.mock("@/db", () => ({ db: mockDb }));

vi.mock("@/lib/auth-middleware", () => ({
  getAuthUserFromRequest: vi.fn(async () => ({
    id: 1,
    username: "test",
    apiKey: "key",
    createdAt: "2026-04-01T00:00:00.000Z",
  })),
  unauthorized: vi.fn(() => Response.json({ error: "Unauthorized" })),
}));

vi.mock("@/core/task", () => ({
  completeTask: mocks.completeTask,
  createTask: mocks.createTask,
  deleteTask: mocks.deleteTask,
  getTask: mocks.getTask,
  listTasks: mocks.listTasks,
  updateTask: mocks.updateTask,
}));

vi.mock("@/core/recurrence-editing", () => ({
  deleteAllInstances: mocks.deleteAllInstances,
  deleteThisAndFuture: mocks.deleteThisAndFuture,
  deleteThisInstance: mocks.deleteThisInstance,
  editAllInstances: mocks.editAllInstances,
  editThisAndFuture: mocks.editThisAndFuture,
  editThisInstance: mocks.editThisInstance,
}));

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("task route validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTask.mockReturnValue({
      id: 1,
      userId: 1,
      recurrence: null,
      status: "pending",
    });
  });

  it("normalizes create payloads before persistence", async () => {
    mocks.createTask.mockReturnValue({ id: 1, description: "Planning" });

    const response = await POST(
      jsonRequest("http://delta.test/api/tasks", {
        description: "  <b>Planning</b>  ",
        due: "2026-04-01",
        location: "  Office  ",
        locationLat: 40.7128,
        locationLon: -74.006,
        meetingUrl: "  https://meet.example/planning  ",
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.createTask).toHaveBeenCalledWith(mockDb, 1, {
      description: "Planning",
      due: "2026-04-01",
      location: "Office",
      locationLat: 40.7128,
      locationLon: -74.006,
      meetingUrl: "https://meet.example/planning",
    });
  });

  it("rejects invalid create payloads before persistence", async () => {
    const response = await POST(
      jsonRequest("http://delta.test/api/tasks", {
        description: "Planning",
        meetingUrl: "meet.example/planning",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.details).toEqual([
      {
        field: "meetingUrl",
        message:
          "meetingUrl must be a valid URL starting with http:// or https://",
      },
    ]);
    expect(mocks.createTask).not.toHaveBeenCalled();
  });

  it("normalizes update payloads before persistence", async () => {
    mocks.updateTask.mockReturnValue({ id: 1, description: "Planning" });

    const response = await PATCH(
      jsonRequest("http://delta.test/api/tasks/1", {
        notes: "<p>Bring notes</p>",
        location: "  Office  ",
        meetingUrl: null,
      }),
      { params: Promise.resolve({ id: "1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.updateTask).toHaveBeenCalledWith(mockDb, 1, {
      notes: "Bring notes",
      location: "Office",
      meetingUrl: null,
    });
  });
});
