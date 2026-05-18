"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { isSettingsPath } from "@/lib/settings-navigation";
import type { ShortcutPerfTracker } from "@/lib/shortcut-perf";

interface SettingsLaunchContextValue {
  openSettings: (href: string, metric?: ShortcutPerfTracker) => void;
}

const SettingsLaunchContext = createContext<SettingsLaunchContextValue | null>(
  null,
);

export function SettingsLauncherProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const pendingMetricRef = useRef<ShortcutPerfTracker | null>(null);

  const openSettings = useCallback(
    (href: string, metric?: ShortcutPerfTracker) => {
      pendingMetricRef.current = metric ?? null;
      router.push(href);
    },
    [router],
  );

  useEffect(() => {
    if (!isSettingsPath(pathname)) return;
    const metric = pendingMetricRef.current;
    if (!metric) return;
    pendingMetricRef.current = null;
    metric.markVisibleAfterFrame();
    metric.markSettledAfterFrame();
  }, [pathname]);

  const value = useMemo(() => ({ openSettings }), [openSettings]);

  return (
    <SettingsLaunchContext.Provider value={value}>
      {children}
    </SettingsLaunchContext.Provider>
  );
}

export function useSettingsLauncher(): SettingsLaunchContextValue {
  const ctx = useContext(SettingsLaunchContext);
  if (!ctx) {
    throw new Error(
      "useSettingsLauncher must be used within SettingsLauncherProvider",
    );
  }
  return ctx;
}
