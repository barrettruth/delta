import { TaskList } from "@/components/task-list";
import { listTasks } from "@/core/task";
import type { TaskFilters, TaskStatus } from "@/core/types";
import { db } from "@/db";

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string }>;
}) {
  const params = await searchParams;
  const filters: TaskFilters = {
    sortBy: "createdAt",
    sortOrder: "desc",
  };

  if (params.category) filters.category = params.category;
  if (params.status) {
    filters.status = params.status.split(",") as TaskStatus[];
  }

  const allTasks = listTasks(db);
  const tasks = listTasks(db, filters);
  const categories = [
    ...new Set(allTasks.map((t) => t.category).filter(Boolean)),
  ] as string[];

  return <TaskList tasks={tasks} categories={categories} />;
}
