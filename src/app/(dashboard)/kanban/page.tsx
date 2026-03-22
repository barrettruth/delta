import { KanbanBoard } from "@/components/kanban-board";
import { listTasks } from "@/core/task";
import { db } from "@/db";

export default function KanbanPage() {
  const tasks = listTasks(db, { sortBy: "priority", sortOrder: "desc" });
  return <KanbanBoard tasks={tasks} />;
}
