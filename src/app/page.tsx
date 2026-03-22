import { AppSidebar } from "@/components/app-sidebar";
import { TaskList } from "@/components/task-list";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { listTasks } from "@/core/task";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string }>;
}) {
  return <HomeContent searchParams={searchParams} />;
}

async function HomeContent({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string }>;
}) {
  const params = await searchParams;
  const filters: Parameters<typeof listTasks>[1] = {
    sortBy: "createdAt",
    sortOrder: "desc",
  };

  if (params.category) filters.category = params.category;
  if (params.status) {
    filters.status = params.status.includes(",")
      ? (params.status.split(",") as Parameters<typeof listTasks>[1] extends {
          status?: infer S;
        }
          ? S extends (infer E)[]
            ? E[]
            : never
          : never)
      : (params.status as "pending" | "done" | "wip" | "blocked" | "cancelled");
  }

  const tasks = listTasks(db, filters);
  const allTasks = listTasks(db);
  const categories = [
    ...new Set(allTasks.map((t) => t.category).filter(Boolean)),
  ] as string[];

  return (
    <>
      <AppSidebar categories={categories} />
      <SidebarInset>
        <header className="flex items-center gap-2 px-4 h-12 border-b">
          <SidebarTrigger />
        </header>
        <TaskList tasks={tasks} title={params.category ?? "All Tasks"} />
      </SidebarInset>
    </>
  );
}
