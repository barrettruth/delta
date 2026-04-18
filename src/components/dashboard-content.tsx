"use client";

import { StatusBar } from "@/components/status-bar";
import { TaskPanel } from "@/components/task-panel";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { TaskPanelProvider, useTaskPanel } from "@/contexts/task-panel";
import type { Task } from "@/core/types";
import { useIsMobile } from "@/hooks/use-mobile";

function MobileTaskOverlay({ tasks }: { tasks: Task[] }) {
  const panel = useTaskPanel();
  const isMobile = useIsMobile();

  if (!isMobile || !panel.isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col">
      <TaskPanel tasks={tasks} />
    </div>
  );
}

function DesktopTaskOverlay({ tasks }: { tasks: Task[] }) {
  const panel = useTaskPanel();
  const isMobile = useIsMobile();

  if (isMobile || !panel.isOpen) return null;

  // Positioned absolute inside the main-row container so the bottom edge
  // naturally aligns with the top of the StatusBar (no magic offsets).
  return (
    <div
      className="absolute inset-y-0 right-0 z-40 flex shadow-2xl shadow-black/20 animate-in slide-in-from-right-4 duration-150"
      style={{ width: `${panel.width}%` }}
    >
      <TaskPanel tasks={tasks} />
    </div>
  );
}

export function DashboardContent({
  children,
  tasks,
}: {
  children: React.ReactNode;
  tasks: Task[];
}) {
  return (
    <TaskPanelProvider>
      <div className="relative flex flex-1 min-h-0">
        <main className="flex-1 min-w-0 overflow-hidden bg-background">
          <div className="md:hidden flex items-center h-10 px-2 border-b border-border/60 shrink-0">
            <SidebarTrigger />
          </div>
          {children}
        </main>
        <DesktopTaskOverlay tasks={tasks} />
        <MobileTaskOverlay tasks={tasks} />
      </div>
      <StatusBar />
    </TaskPanelProvider>
  );
}
