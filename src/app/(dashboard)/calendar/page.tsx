import { CalendarView } from "@/components/calendar-view";
import { listTasks } from "@/core/task";
import { db } from "@/db";

export default function CalendarPage() {
  const tasks = listTasks(db);
  return <CalendarView tasks={tasks} />;
}
