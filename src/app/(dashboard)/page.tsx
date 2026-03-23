import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { TaskList } from "@/components/task-list";
import { validateSession } from "@/core/auth";
import type { ViewType } from "@/core/settings";
import { getSettings } from "@/core/settings";
import { listTasks } from "@/core/task";
import type { TaskFilters, TaskStatus } from "@/core/types";
import { db } from "@/db";

const viewRoutes: Record<ViewType, string> = {
  queue: "/queue",
  list: "/",
  kanban: "/kanban",
  calendar: "/calendar",
};

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  const user = sessionId ? validateSession(db, sessionId) : null;
  const settings = user ? getSettings(db, user.id) : null;

  if (
    settings &&
    settings.defaultView !== "list" &&
    !params.category &&
    !params.status
  ) {
    redirect(viewRoutes[settings.defaultView]);
  }

  const filters: TaskFilters = {
    sortBy: "createdAt",
    sortOrder: "desc",
  };

  if (params.category) filters.category = params.category;
  if (params.status) {
    filters.status = params.status.split(",") as TaskStatus[];
  }

  if (settings && !settings.showCompletedTasks && !params.status) {
    filters.status = ["pending", "wip", "blocked"];
  }

  const allTasks = listTasks(db);
  const tasks = listTasks(db, filters);
  const categories = [
    ...new Set(allTasks.map((t) => t.category).filter(Boolean)),
  ] as string[];

  return (
    <TaskList
      tasks={tasks}
      categories={categories}
      defaultCategory={settings?.defaultCategory}
    />
  );
}
