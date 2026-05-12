import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/export/ical/route";

const mocks = vi.hoisted(() => ({
  listTasks: vi.fn(),
  tasksToICalendar: vi.fn(),
}));

const mockDb = vi.hoisted(() => ({}));

vi.mock("@/db", () => ({ db: mockDb }));

vi.mock("@/lib/auth-responses", () => ({
  unauthorized: vi.fn(() =>
    Response.json({ error: "Unauthorized" }, { status: 401 }),
  ),
}));

vi.mock("@/lib/request-auth", () => ({
  getApiKeyUserOrLocalOwnerFromRequest: vi.fn(async () => ({
    id: 1,
    username: "test",
    apiKey: "key",
    createdAt: "2026-04-01T00:00:00.000Z",
  })),
}));

vi.mock("@/core/task", () => ({
  listTasks: mocks.listTasks,
}));

vi.mock("@/core/ical/serializer", () => ({
  tasksToICalendar: mocks.tasksToICalendar,
}));

describe("iCal export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tasksToICalendar.mockReturnValue("BEGIN:VCALENDAR");
  });

  it("normalizes export filters and serializes calendar tasks only", async () => {
    const calendarTask = {
      id: 1,
      description: "Planning",
      startAt: "2026-05-11T14:00:00.000Z",
    };
    const taskWithoutStart = {
      id: 2,
      description: "Backlog",
      startAt: null,
    };
    mocks.listTasks.mockReturnValue([calendarTask, taskWithoutStart]);

    const response = await GET(
      new Request(
        "http://delta.test/api/export/ical?status=done,wip&category=Work&from=2026-05-01T00:00:00.000Z&to=2026-05-31T23:59:59.999Z",
      ),
    );

    expect(mocks.listTasks).toHaveBeenCalledWith(mockDb, 1, {
      status: ["done", "wip"],
      category: "Work",
      dueAfter: "2026-05-01T00:00:00.000Z",
      dueBefore: "2026-05-31T23:59:59.999Z",
    });
    expect(mocks.tasksToICalendar).toHaveBeenCalledWith([calendarTask]);
    expect(response.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8",
    );
    expect(await response.text()).toBe("BEGIN:VCALENDAR");
  });
});
