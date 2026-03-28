import { tasksToICalendar } from "@/core/ical/serializer";
import { listTasks } from "@/core/task";
import type { TaskFilters, TaskStatus } from "@/core/types";
import { db } from "@/db";
import { getAuthUserFromRequest, unauthorized } from "@/lib/auth-middleware";

export async function GET(request: Request) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const filters: TaskFilters = {};

  const category = searchParams.get("category");
  if (category) filters.category = category;

  const from = searchParams.get("from");
  if (from) filters.dueAfter = from;

  const to = searchParams.get("to");
  if (to) filters.dueBefore = to;

  const status = searchParams.get("status");
  if (status) {
    filters.status = status.includes(",")
      ? (status.split(",") as TaskStatus[])
      : (status as TaskStatus);
  }

  const tasks = listTasks(db, user.id, filters);
  const calendarEvents = tasks.filter((t) => t.startAt);
  const ical = tasksToICalendar(calendarEvents);

  return new Response(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="delta-events.ics"',
    },
  });
}
