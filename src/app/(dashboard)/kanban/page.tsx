import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { KanbanBoard } from "@/components/kanban-board";
import { validateSession } from "@/core/auth";
import { listTasks } from "@/core/task";
import { db } from "@/db";

export default async function KanbanPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) redirect("/login");
  const user = validateSession(db, sessionId);
  if (!user) redirect("/login");

  const tasks = listTasks(db, user.id, {
    sortBy: "priority",
    sortOrder: "desc",
  });
  return <KanbanBoard tasks={tasks} />;
}
