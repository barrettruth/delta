import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { KanbanBoard } from "@/components/kanban-board";
import { validateSession } from "@/core/auth";
import { getSettings } from "@/core/settings";
import { listTasks } from "@/core/task";
import type { TaskFilters } from "@/core/types";
import { db } from "@/db";

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ showDone?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) redirect("/login");
  const user = validateSession(db, sessionId);
  if (!user) redirect("/login");
  const settings = getSettings(db, user.id);

  const filters: TaskFilters = {
    sortBy: "order",
    sortOrder: "desc",
  };

  if (!params.showDone && !settings.showCompletedTasks) {
    filters.status = ["pending", "wip", "blocked"];
  }

  const tasks = listTasks(db, user.id, filters);
  return <KanbanBoard tasks={tasks} />;
}
