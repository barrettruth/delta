"use client";

import { NavigationProvider } from "@/contexts/navigation";
import { StatusBarProvider } from "@/contexts/status-bar";
import { UndoProvider } from "@/contexts/undo";

export function NavigationWrapper({ children }: { children: React.ReactNode }) {
  return (
    <NavigationProvider>
      <StatusBarProvider>
        <UndoProvider>{children}</UndoProvider>
      </StatusBarProvider>
    </NavigationProvider>
  );
}
