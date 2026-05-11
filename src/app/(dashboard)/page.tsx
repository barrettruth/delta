import { redirect } from "next/navigation";
import { QueueView } from "@/components/queue-view";
import { loadDashboardQueueData } from "@/server/dashboard-data";

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    status?: string;
    date?: string;
    showDone?: string;
    view?: string;
  }>;
}) {
  const params = await searchParams;
  const data = await loadDashboardQueueData(params);

  if (data.kind === "redirect") {
    redirect(data.redirectTo);
  }

  return (
    <QueueView
      tasks={data.tasks}
      categoryColors={data.categoryColors}
      categoryFilter={data.categoryFilter}
    />
  );
}
