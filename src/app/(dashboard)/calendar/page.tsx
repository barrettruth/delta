import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CalendarView } from "@/components/calendar-view";
import { validateSession } from "@/core/auth";
import { listTasks } from "@/core/task";
import { db } from "@/db";
import { categoryColors } from "@/db/schema";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session")?.value;
  if (!sessionId) redirect("/login");
  const user = validateSession(db, sessionId);
  if (!user) redirect("/login");

  const tasks = listTasks(db, user.id);
  const colors = Object.fromEntries(
    db
      .select()
      .from(categoryColors)
      .where(eq(categoryColors.userId, user.id))
      .all()
      .map((c) => [c.category, c.color]),
  );
  const params = await searchParams;
  const defaultViewMode =
    params.mode === "week" || params.mode === "month" ? params.mode : undefined;
  const categories = [
    ...new Set(tasks.map((t) => t.category).filter(Boolean)),
  ] as string[];
  return (
    <CalendarView
      tasks={tasks}
      categoryColors={colors}
      categories={categories}
      defaultViewMode={defaultViewMode}
    />
  );
}
