"use client";

import { KeymapProvider } from "@/contexts/keymaps";
import { NavigationProvider } from "@/contexts/navigation";
import { StatusBarProvider } from "@/contexts/status-bar";
import { UndoProvider } from "@/contexts/undo";

export function NavigationWrapper({ children }: { children: React.ReactNode }) {
  return (
    <KeymapProvider>
      <NavigationProvider>
        <StatusBarProvider>
          <UndoProvider>{children}</UndoProvider>
        </StatusBarProvider>
      </NavigationProvider>
    </KeymapProvider>
  );
}
