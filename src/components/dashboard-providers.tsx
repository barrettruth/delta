"use client";

import { KeyboardHelpProvider } from "@/contexts/keyboard-help";
import { NavigationProvider } from "@/contexts/navigation";
import { SettingsLauncherProvider } from "@/contexts/settings-launcher";
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
        <SettingsLauncherProvider>
          <KeyboardHelpProvider>
            <UndoProvider>
              <TaskPanelProvider>{children}</TaskPanelProvider>
            </UndoProvider>
          </KeyboardHelpProvider>
        </SettingsLauncherProvider>
      </StatusBarProvider>
    </NavigationProvider>
  );
}
