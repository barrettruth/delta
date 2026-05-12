import "server-only";

import type { SafeUser } from "@/core/auth";
import { getFeedToken } from "@/core/calendar-feed";
import { listCategoryColors } from "@/core/categories";
import { getSettings, type ViewType } from "@/core/settings";
import { listTasks } from "@/core/task";
import { parseTaskFilters } from "@/core/task-filters";
import { ACTIVE_TASK_STATUSES } from "@/core/task-status";
import type { Task, TaskFilters } from "@/core/types";
import { type RankedTask, rankTasks } from "@/core/urgency";
import { db } from "@/db";
import { requireAuthUser } from "@/lib/server-auth";

const viewRoutes: Record<ViewType, string> = {
  queue: "/",
  kanban: "/kanban",
  calendar: "/calendar",
};

export interface DashboardShellData {
  user: SafeUser;
  tasks: Task[];
  categories: string[];
}

export interface DashboardQueueParams {
  category?: string;
  status?: string;
  date?: string;
  showDone?: string;
  view?: string;
}

export type DashboardQueueData =
  | {
      kind: "redirect";
      redirectTo: string;
    }
  | {
      kind: "data";
      tasks: RankedTask[];
      categoryColors: Record<string, string>;
      categoryFilter?: string;
    };

export interface DashboardKanbanParams {
  showDone?: string;
}

export interface DashboardKanbanData {
  tasks: Task[];
}

export interface DashboardCalendarParams {
  mode?: string;
  showDone?: string;
}

export type DashboardCalendarViewMode = "day" | "week" | "month";

export interface DashboardCalendarData {
  tasks: Task[];
  categoryColors: Record<string, string>;
  categories: string[];
  defaultViewMode?: DashboardCalendarViewMode;
  feedToken: string | null;
}

function taskCategories(tasks: Task[]): string[] {
  const categories = tasks
    .map((task) => task.category)
    .filter((category): category is string => Boolean(category));

  return [...new Set(categories)];
}

function shouldShowCompleted(
  showDone: string | undefined,
  settingsShowCompleted: boolean,
): boolean {
  return Boolean(showDone) || settingsShowCompleted;
}

function queueRedirect(
  params: DashboardQueueParams,
  defaultView: ViewType,
): string | undefined {
  if (
    defaultView === "queue" ||
    params.category ||
    params.status ||
    params.date ||
    params.view
  ) {
    return undefined;
  }

  return viewRoutes[defaultView];
}

function queueFilters(
  params: DashboardQueueParams,
  settingsShowCompleted: boolean,
): TaskFilters {
  return parseTaskFilters(params, {
    defaults: {
      status: shouldShowCompleted(params.showDone, settingsShowCompleted)
        ? undefined
        : ACTIVE_TASK_STATUSES,
    },
  });
}

function kanbanFilters(
  params: DashboardKanbanParams,
  settingsShowCompleted: boolean,
): TaskFilters {
  return parseTaskFilters(
    {},
    {
      defaults: {
        sortBy: "order",
        sortOrder: "desc",
        status: shouldShowCompleted(params.showDone, settingsShowCompleted)
          ? undefined
          : ACTIVE_TASK_STATUSES,
      },
    },
  );
}

function calendarFilters(
  params: DashboardCalendarParams,
  settingsShowCompleted: boolean,
): TaskFilters {
  return parseTaskFilters(
    {},
    {
      defaults: {
        status: shouldShowCompleted(params.showDone, settingsShowCompleted)
          ? undefined
          : ACTIVE_TASK_STATUSES,
      },
    },
  );
}

function calendarViewMode(
  mode: string | undefined,
): DashboardCalendarViewMode | undefined {
  if (mode === "day" || mode === "week" || mode === "month") return mode;
  return undefined;
}

export async function loadDashboardShellData(): Promise<DashboardShellData> {
  const user = await requireAuthUser();
  const tasks = listTasks(db, user.id);

  return {
    user,
    tasks,
    categories: taskCategories(tasks),
  };
}

export async function loadDashboardQueueData(
  params: DashboardQueueParams,
): Promise<DashboardQueueData> {
  const user = await requireAuthUser();
  const settings = getSettings(db, user.id);
  const redirectTo = queueRedirect(params, settings.defaultView);

  if (redirectTo) {
    return { kind: "redirect", redirectTo };
  }

  const tasks = listTasks(
    db,
    user.id,
    queueFilters(params, settings.showCompletedTasks),
  );

  return {
    kind: "data",
    tasks: rankTasks(db, tasks, settings.urgencyWeights),
    categoryColors: listCategoryColors(db, user.id),
    categoryFilter: params.category,
  };
}

export async function loadDashboardKanbanData(
  params: DashboardKanbanParams,
): Promise<DashboardKanbanData> {
  const user = await requireAuthUser();
  const settings = getSettings(db, user.id);

  return {
    tasks: listTasks(
      db,
      user.id,
      kanbanFilters(params, settings.showCompletedTasks),
    ),
  };
}

export async function loadDashboardCalendarData(
  params: DashboardCalendarParams,
): Promise<DashboardCalendarData> {
  const user = await requireAuthUser();
  const settings = getSettings(db, user.id);
  const tasks = listTasks(
    db,
    user.id,
    calendarFilters(params, settings.showCompletedTasks),
  );

  return {
    tasks,
    categoryColors: listCategoryColors(db, user.id),
    categories: taskCategories(tasks),
    defaultViewMode: calendarViewMode(params.mode),
    feedToken: getFeedToken(db, user.id),
  };
}
