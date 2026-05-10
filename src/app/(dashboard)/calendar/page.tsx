import { CalendarView } from "@/components/calendar-view";
import { getFeedToken } from "@/core/calendar-feed";
import { listCategoryColors } from "@/core/category-colors";
import { getSettings } from "@/core/settings";
import { listTasks } from "@/core/task";
import { ACTIVE_TASK_STATUSES } from "@/core/task-status";
import type { TaskFilters } from "@/core/types";
import { db } from "@/db";
import { requireAuthUser } from "@/lib/server-auth";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; showDone?: string }>;
}) {
  const user = await requireAuthUser();
  const settings = getSettings(db, user.id);

  const params = await searchParams;
  const filters: TaskFilters = {};
  if (!params.showDone && !settings.showCompletedTasks) {
    filters.status = ACTIVE_TASK_STATUSES;
  }

  const tasks = listTasks(db, user.id, filters);
  const colors = listCategoryColors(db, user.id);
  const defaultViewMode =
    params.mode === "day" || params.mode === "week" || params.mode === "month"
      ? params.mode
      : undefined;
  const categories = [
    ...new Set(tasks.map((t) => t.category).filter(Boolean)),
  ] as string[];

  const feedToken = getFeedToken(db, user.id);

  return (
    <CalendarView
      tasks={tasks}
      categoryColors={colors}
      categories={categories}
      defaultViewMode={defaultViewMode}
      feedToken={feedToken}
    />
  );
}
