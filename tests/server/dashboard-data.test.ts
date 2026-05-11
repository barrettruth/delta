import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SafeUser } from "@/core/auth";
import type { UserSettings } from "@/core/settings";
import { ACTIVE_TASK_STATUSES } from "@/core/task-status";
import type { Task } from "@/core/types";
import type { RankedTask } from "@/core/urgency";
import {
  loadDashboardCalendarData,
  loadDashboardKanbanData,
  loadDashboardQueueData,
  loadDashboardShellData,
} from "@/server/dashboard-data";

const mocks = vi.hoisted(() => ({
  db: { test: "db" },
  getFeedToken: vi.fn(),
  getSettings: vi.fn(),
  listCategoryColors: vi.fn(),
  listTasks: vi.fn(),
  rankTasks: vi.fn(),
  requireAuthUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: mocks.db }));
vi.mock("@/core/calendar-feed", () => ({
  getFeedToken: mocks.getFeedToken,
}));
vi.mock("@/core/category-colors", () => ({
  listCategoryColors: mocks.listCategoryColors,
}));
vi.mock("@/core/settings", () => ({
  getSettings: mocks.getSettings,
}));
vi.mock("@/core/task", () => ({
  listTasks: mocks.listTasks,
}));
vi.mock("@/core/urgency", () => ({
  rankTasks: mocks.rankTasks,
}));
vi.mock("@/lib/server-auth", () => ({
  requireAuthUser: mocks.requireAuthUser,
}));

const user = { id: 7, username: "barrett" } as SafeUser;

function task(id: number, category: string | null): Task {
  return {
    id,
    userId: user.id,
    category,
    description: `task ${id}`,
    status: "pending",
  } as Task;
}

function settings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    defaultCategory: "Todo",
    defaultView: "queue",
    showCompletedTasks: true,
    urgencyWeights: {
      due: 12,
      age: 2,
      wip: 4,
      blocking: 8,
    },
    ...overrides,
  };
}

describe("dashboard data loaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthUser.mockResolvedValue(user);
    mocks.getSettings.mockReturnValue(settings());
    mocks.listTasks.mockReturnValue([]);
    mocks.listCategoryColors.mockReturnValue({});
    mocks.rankTasks.mockImplementation((_db, tasks: Task[]) =>
      tasks.map((item) => ({ ...item, urgency: 0 })),
    );
    mocks.getFeedToken.mockReturnValue(null);
  });

  it("loads shell data with de-duplicated task categories", async () => {
    const tasks = [
      task(1, "Work"),
      task(2, null),
      task(3, "Work"),
      task(4, "Home"),
    ];
    const categoryColors = { Work: "#111111" };
    mocks.listTasks.mockReturnValue(tasks);
    mocks.listCategoryColors.mockReturnValue(categoryColors);

    const data = await loadDashboardShellData();

    expect(mocks.requireAuthUser).toHaveBeenCalledOnce();
    expect(mocks.listTasks).toHaveBeenCalledWith(mocks.db, user.id);
    expect(mocks.listCategoryColors).toHaveBeenCalledWith(mocks.db, user.id);
    expect(data).toEqual({
      user,
      tasks,
      categories: ["Work", "Home"],
      categoryColors,
    });
  });

  it("short-circuits queue data when the default view redirects", async () => {
    mocks.getSettings.mockReturnValue(
      settings({ defaultView: "calendar", showCompletedTasks: false }),
    );

    const data = await loadDashboardQueueData({ showDone: "1" });

    expect(data).toEqual({ kind: "redirect", redirectTo: "/calendar" });
    expect(mocks.listTasks).not.toHaveBeenCalled();
    expect(mocks.rankTasks).not.toHaveBeenCalled();
    expect(mocks.listCategoryColors).not.toHaveBeenCalled();
  });

  it("loads ranked queue data with route filters", async () => {
    const configuredSettings = settings({ showCompletedTasks: false });
    const tasks = [task(1, "Work")];
    const ranked = [{ ...tasks[0], urgency: 4 }] as RankedTask[];
    const categoryColors = { Work: "#222222" };
    mocks.getSettings.mockReturnValue(configuredSettings);
    mocks.listTasks.mockReturnValue(tasks);
    mocks.rankTasks.mockReturnValue(ranked);
    mocks.listCategoryColors.mockReturnValue(categoryColors);

    const data = await loadDashboardQueueData({
      category: "Work",
      date: "2026-05-11",
    });

    expect(mocks.listTasks).toHaveBeenCalledWith(mocks.db, user.id, {
      category: "Work",
      dueAfter: "2026-05-11T00:00:00.000Z",
      dueBefore: "2026-05-11T23:59:59.999Z",
      status: ACTIVE_TASK_STATUSES,
    });
    expect(mocks.rankTasks).toHaveBeenCalledWith(
      mocks.db,
      tasks,
      configuredSettings.urgencyWeights,
    );
    expect(data).toEqual({
      kind: "data",
      tasks: ranked,
      categoryColors,
      categoryFilter: "Work",
    });
  });

  it("preserves explicit queue status filters", async () => {
    mocks.getSettings.mockReturnValue(settings({ showCompletedTasks: false }));

    await loadDashboardQueueData({ status: "done,wip" });

    expect(mocks.listTasks).toHaveBeenCalledWith(mocks.db, user.id, {
      status: ["done", "wip"],
    });
  });

  it("loads kanban data with board ordering", async () => {
    mocks.getSettings.mockReturnValue(settings({ showCompletedTasks: false }));
    const tasks = [task(1, "Work")];
    mocks.listTasks.mockReturnValue(tasks);

    const data = await loadDashboardKanbanData({});

    expect(mocks.listTasks).toHaveBeenCalledWith(mocks.db, user.id, {
      sortBy: "order",
      sortOrder: "desc",
      status: ACTIVE_TASK_STATUSES,
    });
    expect(data).toEqual({ tasks });
  });

  it("loads calendar data with settings, categories, and feed token", async () => {
    mocks.getSettings.mockReturnValue(settings({ showCompletedTasks: false }));
    const tasks = [task(1, "Work"), task(2, "Home")];
    const categoryColors = { Work: "#111111", Home: "#222222" };
    mocks.listTasks.mockReturnValue(tasks);
    mocks.listCategoryColors.mockReturnValue(categoryColors);
    mocks.getFeedToken.mockReturnValue("feed-token");

    const data = await loadDashboardCalendarData({ mode: "month" });

    expect(mocks.listTasks).toHaveBeenCalledWith(mocks.db, user.id, {
      status: ACTIVE_TASK_STATUSES,
    });
    expect(mocks.listCategoryColors).toHaveBeenCalledWith(mocks.db, user.id);
    expect(mocks.getFeedToken).toHaveBeenCalledWith(mocks.db, user.id);
    expect(data).toEqual({
      tasks,
      categoryColors,
      categories: ["Work", "Home"],
      defaultViewMode: "month",
      feedToken: "feed-token",
    });
  });
});
