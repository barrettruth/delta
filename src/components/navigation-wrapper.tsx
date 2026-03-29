"use client";

import { CommandBarProvider } from "@/contexts/command-bar";
import { KeymapProvider } from "@/contexts/keymaps";
import { NavigationProvider } from "@/contexts/navigation";
import { StatusBarProvider } from "@/contexts/status-bar";
import { UndoProvider } from "@/contexts/undo";

export function NavigationWrapper({
  keymapOverrides,
  children,
}: {
  keymapOverrides: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <KeymapProvider initialOverrides={keymapOverrides}>
      <NavigationProvider>
        <StatusBarProvider>
          <CommandBarProvider>
            <UndoProvider>{children}</UndoProvider>
          </CommandBarProvider>
        </StatusBarProvider>
      </NavigationProvider>
    </KeymapProvider>
  );
}
