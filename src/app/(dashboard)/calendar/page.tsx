import { cookies } from "next/headers";
import { CalendarView } from "@/components/calendar-view";
import { validateSession } from "@/core/auth";
import { getSettings } from "@/core/settings";
import { listTasks } from "@/core/task";
import { db } from "@/db";

export default async function CalendarPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  const user = sessionId ? validateSession(db, sessionId) : null;
  const settings = user ? getSettings(db, user.id) : null;

  const tasks = listTasks(db);
  const categories = [
    ...new Set(tasks.map((t) => t.category).filter(Boolean)),
  ] as string[];
  return (
    <CalendarView
      tasks={tasks}
      categories={categories}
      weekStartDay={settings?.weekStartDay ?? 1}
      dateFormat={settings?.dateFormat ?? "us"}
      defaultCategory={settings?.defaultCategory}
    />
  );
}
