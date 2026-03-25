"use client";

import { NavigationProvider } from "@/contexts/navigation";

export function NavigationWrapper({ children }: { children: React.ReactNode }) {
  return <NavigationProvider>{children}</NavigationProvider>;
}
