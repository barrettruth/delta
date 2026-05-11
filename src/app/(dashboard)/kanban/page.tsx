import { KanbanBoard } from "@/components/kanban-board";
import { loadDashboardKanbanData } from "@/server/dashboard-data";

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ showDone?: string }>;
}) {
  const params = await searchParams;
  const { tasks } = await loadDashboardKanbanData(params);
  return <KanbanBoard tasks={tasks} />;
}
