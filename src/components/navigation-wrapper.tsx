"use client";

import { NavigationProvider } from "@/contexts/navigation";
import { UndoProvider } from "@/contexts/undo";

export function NavigationWrapper({ children }: { children: React.ReactNode }) {
  return (
    <NavigationProvider>
      <UndoProvider>{children}</UndoProvider>
    </NavigationProvider>
  );
}
