"use client";

import { KeyboardHelpProvider } from "@/contexts/keyboard-help";
import { NavigationProvider } from "@/contexts/navigation";
import { StatusBarProvider } from "@/contexts/status-bar";
import { TaskPanelProvider } from "@/contexts/task-panel";
import { UndoProvider } from "@/contexts/undo";

export function DashboardProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NavigationProvider>
      <StatusBarProvider>
        <KeyboardHelpProvider>
          <UndoProvider>
            <TaskPanelProvider>{children}</TaskPanelProvider>
          </UndoProvider>
        </KeyboardHelpProvider>
      </StatusBarProvider>
    </NavigationProvider>
  );
}
