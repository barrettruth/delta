import { tasksToICalendar } from "@/core/ical/serializer";
import { listTasks } from "@/core/task";
import { parseTaskFilters } from "@/core/task-filters";
import { db } from "@/db";
import { unauthorized } from "@/lib/auth-responses";
import { getApiKeyUserOrLocalOwnerFromRequest } from "@/lib/request-auth";

export async function GET(request: Request) {
  const user = await getApiKeyUserOrLocalOwnerFromRequest(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const filters = parseTaskFilters({
    category: searchParams.get("category"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    status: searchParams.get("status"),
  });

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
