"use client";

import { KeyboardHelpProvider } from "@/contexts/keyboard-help";
import { NavigationProvider } from "@/contexts/navigation";
import { StatusBarProvider } from "@/contexts/status-bar";
import { UndoProvider } from "@/contexts/undo";

export function NavigationWrapper({ children }: { children: React.ReactNode }) {
  return (
    <NavigationProvider>
      <StatusBarProvider>
        <KeyboardHelpProvider>
          <UndoProvider>{children}</UndoProvider>
        </KeyboardHelpProvider>
      </StatusBarProvider>
    </NavigationProvider>
  );
}
