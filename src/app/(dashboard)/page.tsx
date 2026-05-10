import { redirect } from "next/navigation";
import { QueueView } from "@/components/queue-view";
import { listCategoryColors } from "@/core/category-colors";
import type { ViewType } from "@/core/settings";
import { getSettings } from "@/core/settings";
import { listTasks } from "@/core/task";
import { ACTIVE_TASK_STATUSES } from "@/core/task-status";
import type { TaskFilters, TaskStatus } from "@/core/types";
import { rankTasks } from "@/core/urgency";
import { db } from "@/db";
import { requireAuthUser } from "@/lib/server-auth";

const viewRoutes: Record<ViewType, string> = {
  queue: "/",
  kanban: "/kanban",
  calendar: "/calendar",
};

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    status?: string;
    date?: string;
    showDone?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await requireAuthUser();
  const settings = getSettings(db, user.id);

  if (
    settings.defaultView !== "queue" &&
    !params.category &&
    !params.status &&
    !params.date &&
    !params.view
  ) {
    redirect(viewRoutes[settings.defaultView]);
  }

  const filters: TaskFilters = {};

  if (params.category) filters.category = params.category;
  if (params.status) {
    filters.status = params.status.split(",") as TaskStatus[];
  }
  if (params.date) {
    filters.dueAfter = `${params.date}T00:00:00.000Z`;
    filters.dueBefore = `${params.date}T23:59:59.999Z`;
  }

  if (!params.showDone && !settings.showCompletedTasks && !params.status) {
    filters.status = ACTIVE_TASK_STATUSES;
  }

  const tasks = listTasks(db, user.id, filters);
  const ranked = rankTasks(db, tasks, settings.urgencyWeights);
  const colors = listCategoryColors(db, user.id);
  return (
    <QueueView
      tasks={ranked}
      categoryColors={colors}
      categoryFilter={params.category}
    />
  );
}
