import { CalendarView } from "@/components/calendar-view";
import { loadDashboardCalendarData } from "@/server/dashboard-data";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; showDone?: string }>;
}) {
  const params = await searchParams;
  const { tasks, categoryColors, categories, defaultViewMode, feedToken } =
    await loadDashboardCalendarData(params);

  return (
    <CalendarView
      tasks={tasks}
      categoryColors={categoryColors}
      categories={categories}
      defaultViewMode={defaultViewMode}
      feedToken={feedToken}
    />
  );
}
