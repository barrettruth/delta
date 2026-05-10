import { KanbanBoard } from "@/components/kanban-board";
import { getSettings } from "@/core/settings";
import { listTasks } from "@/core/task";
import { ACTIVE_TASK_STATUSES } from "@/core/task-status";
import type { TaskFilters } from "@/core/types";
import { db } from "@/db";
import { requireAuthUser } from "@/lib/server-auth";

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ showDone?: string }>;
}) {
  const params = await searchParams;
  const user = await requireAuthUser();
  const settings = getSettings(db, user.id);

  const filters: TaskFilters = {
    sortBy: "order",
    sortOrder: "desc",
  };

  if (!params.showDone && !settings.showCompletedTasks) {
    filters.status = ACTIVE_TASK_STATUSES;
  }

  const tasks = listTasks(db, user.id, filters);
  return <KanbanBoard tasks={tasks} />;
}
