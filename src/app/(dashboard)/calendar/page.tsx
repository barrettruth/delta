import { CalendarView } from "@/components/calendar-view";
import { listTasks } from "@/core/task";
import { db } from "@/db";

export default function CalendarPage() {
  const tasks = listTasks(db);
  const categories = [
    ...new Set(tasks.map((t) => t.category).filter(Boolean)),
  ] as string[];
  return <CalendarView tasks={tasks} categories={categories} />;
}
