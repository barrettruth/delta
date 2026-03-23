import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { QueueView } from "@/components/queue-view";
import { validateSession } from "@/core/auth";
import type { ViewType } from "@/core/settings";
import { getSettings } from "@/core/settings";
import { listTasks } from "@/core/task";
import type { TaskFilters, TaskStatus } from "@/core/types";
import { rankTasks } from "@/core/urgency";
import { db } from "@/db";

const viewRoutes: Record<ViewType, string> = {
  queue: "/",
  list: "/",
  kanban: "/kanban",
  calendar: "/calendar",
};

export default async function QueuePage({
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
    settings.defaultView !== "queue" &&
    settings.defaultView !== "list" &&
    !params.category &&
    !params.status
  ) {
    redirect(viewRoutes[settings.defaultView]);
  }

  const filters: TaskFilters = {};

  if (params.category) filters.category = params.category;
  if (params.status) {
    filters.status = params.status.split(",") as TaskStatus[];
  }

  if (settings && !settings.showCompletedTasks && !params.status) {
    filters.status = ["pending", "wip", "blocked"];
  }

  const allTasks = listTasks(db);
  const tasks = listTasks(db, filters);
  const ranked = rankTasks(db, tasks, settings?.urgencyWeights);
  const categories = [
    ...new Set(allTasks.map((t) => t.category).filter(Boolean)),
  ] as string[];

  return (
    <QueueView
      tasks={ranked}
      categories={categories}
      defaultCategory={settings?.defaultCategory}
    />
  );
}
