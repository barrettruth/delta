"use client";

import { TaskPanel } from "@/components/task-panel";
import { TaskPanelProvider } from "@/contexts/task-panel";
import type { Task } from "@/core/types";

export function DashboardContent({
  children,
  tasks,
}: {
  children: React.ReactNode;
  tasks: Task[];
}) {
  return (
    <TaskPanelProvider>
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 min-w-0 overflow-hidden bg-background">
          {children}
        </main>
        <TaskPanel tasks={tasks} />
      </div>
    </TaskPanelProvider>
  );
}
