import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CalendarView } from "@/components/calendar-view";
import { validateSession } from "@/core/auth";
import { getSettings } from "@/core/settings";
import { listTasks } from "@/core/task";
import { db } from "@/db";

export default async function CalendarPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) redirect("/login");
  const user = validateSession(db, sessionId);
  if (!user) redirect("/login");
  const settings = getSettings(db, user.id);

  const tasks = listTasks(db, user.id);
  const categories = [
    ...new Set(tasks.map((t) => t.category).filter(Boolean)),
  ] as string[];
  return (
    <CalendarView
      tasks={tasks}
      categories={categories}
      weekStartDay={settings.weekStartDay ?? 1}
      defaultCategory={settings.defaultCategory}
    />
  );
}
