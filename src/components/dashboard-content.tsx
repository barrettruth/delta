"use client";

import { usePathname } from "next/navigation";
import { StatusBar } from "@/components/status-bar";
import { TaskPanel } from "@/components/task-panel";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { TaskPanelProvider, useTaskPanel } from "@/contexts/task-panel";
import type { Task } from "@/core/types";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * On /calendar, the panel is rendered inline as a Google-style popover
 * anchored to the clicked event (see CalendarView). On every other page
 * it's the classic side-by-side right sidebar.
 */
function usePanelLayout(): "sidebar" | "none" {
  const pathname = usePathname();
  if (pathname === "/calendar" || pathname.startsWith("/calendar/")) {
    return "none";
  }
  return "sidebar";
}

function MobileTaskOverlay({ tasks }: { tasks: Task[] }) {
  const panel = useTaskPanel();
  const isMobile = useIsMobile();
  const layout = usePanelLayout();

  if (layout === "none") return null;
  if (!isMobile || !panel.isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col">
      <TaskPanel tasks={tasks} />
    </div>
  );
}

function DesktopTaskSidebar({ tasks }: { tasks: Task[] }) {
  const panel = useTaskPanel();
  const isMobile = useIsMobile();
  const layout = usePanelLayout();

  if (layout === "none") return null;
  if (isMobile || !panel.isOpen) return null;

  return <TaskPanel tasks={tasks} />;
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
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 min-w-0 overflow-hidden bg-background">
          <div className="md:hidden flex items-center h-10 px-2 border-b border-border/60 shrink-0">
            <SidebarTrigger />
          </div>
          {children}
        </main>
        <div className="hidden md:contents">
          <DesktopTaskSidebar tasks={tasks} />
        </div>
        <MobileTaskOverlay tasks={tasks} />
      </div>
      <StatusBar />
    </TaskPanelProvider>
  );
}
