"use client";

import { X } from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getActiveSettingsIndex,
  isSettingsPath,
  SETTINGS_SECTIONS,
} from "@/lib/settings-navigation";
import type { ShortcutPerfTracker } from "@/lib/shortcut-perf";

interface SettingsLaunchContextValue {
  openSettings: (href: string, metric?: ShortcutPerfTracker) => void;
}

interface SettingsPreview {
  href: string;
  pathname: string;
  metric?: ShortcutPerfTracker;
}

const SettingsLaunchContext = createContext<SettingsLaunchContextValue | null>(
  null,
);

function afterNextPaint(callback: () => void): () => void {
  if (typeof requestAnimationFrame === "undefined") {
    const timeoutId = setTimeout(callback, 0);
    return () => clearTimeout(timeoutId);
  }
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const frameId = requestAnimationFrame(() => {
    timeoutId = setTimeout(callback, 0);
  });
  return () => {
    cancelAnimationFrame(frameId);
    if (timeoutId) clearTimeout(timeoutId);
  };
}

function settingsPreviewFromHref(
  href: string,
  origin: string,
  metric?: ShortcutPerfTracker,
): SettingsPreview {
  const url = new URL(href, origin);
  return {
    href,
    pathname: url.pathname,
    metric,
  };
}

function SettingsPreviewContent({ metric }: { metric?: ShortcutPerfTracker }) {
  useEffect(() => {
    metric?.markVisible();
  }, [metric]);

  return (
    <div className="w-full px-5 py-5 md:px-8 md:py-6" aria-hidden="true">
      <div className="mb-6 space-y-2 border-b border-border/60 pb-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </div>
      <div className="grid gap-7 lg:grid-cols-2">
        {[0, 1, 2, 3].map((section) => (
          <section key={section} className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <div className="divide-y divide-border/40 border-y border-border/40">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-3 px-3 py-2.5">
                  <Skeleton className="h-3 flex-1" />
                  <Skeleton className="h-3 w-14" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function SettingsLocalPreview({
  onClose,
  preview,
}: {
  onClose: () => void;
  preview: SettingsPreview;
}) {
  const activeIndex = getActiveSettingsIndex(preview.pathname);
  const activeSection = SETTINGS_SECTIONS[activeIndex];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key !== "q") return;
      event.preventDefault();
      onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[3px]" />
      <div
        aria-label="settings"
        aria-modal="true"
        className="
          fixed top-1/2 left-1/2 z-50
          flex h-[min(720px,calc(100vh-1.5rem))]
          w-[min(1120px,calc(100vw-1.5rem))]
          -translate-x-1/2 -translate-y-1/2
          flex-col overflow-hidden border border-border bg-popover
          shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)]
          md:flex-row
        "
        role="dialog"
      >
        <nav className="flex shrink-0 flex-row border-b border-border/60 bg-sidebar md:w-52 md:flex-col md:border-r md:border-b-0">
          {SETTINGS_SECTIONS.map((section) => {
            const active = section.id === activeSection.id;
            return (
              <div
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center px-4 py-2 text-sm md:w-full md:py-1.5 ${
                  active
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground"
                }`}
                key={section.id}
              >
                <span className="truncate">{section.label}</span>
              </div>
            );
          })}
        </nav>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-border/60 pr-1 pl-4">
            <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">
              settings
            </span>
            <button
              aria-label="close settings"
              className="flex size-6 cursor-pointer items-center justify-center text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              onClick={onClose}
              type="button"
            >
              <X size={13} weight="bold" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SettingsPreviewContent metric={preview.metric} />
          </div>
        </div>
      </div>
    </>
  );
}

export function SettingsLauncherProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [preview, setPreview] = useState<SettingsPreview | null>(null);
  const cancelPendingRouteRef = useRef<(() => void) | null>(null);
  const cancelPendingRoute = useCallback(() => {
    cancelPendingRouteRef.current?.();
    cancelPendingRouteRef.current = null;
  }, []);

  const openSettings = useCallback(
    (href: string, metric?: ShortcutPerfTracker) => {
      const origin =
        typeof window === "undefined"
          ? "http://delta.local"
          : window.location.origin;
      cancelPendingRoute();
      flushSync(() => {
        setPreview(settingsPreviewFromHref(href, origin, metric));
      });
      cancelPendingRouteRef.current = afterNextPaint(() => {
        cancelPendingRouteRef.current = null;
        router.push(href);
      });
    },
    [cancelPendingRoute, router],
  );

  useEffect(() => {
    if (!preview || !isSettingsPath(pathname)) return;
    cancelPendingRoute();
    preview.metric?.markSettledAfterFrame();
    setPreview(null);
  }, [cancelPendingRoute, pathname, preview]);

  useEffect(() => cancelPendingRoute, [cancelPendingRoute]);

  const value = useMemo(() => ({ openSettings }), [openSettings]);

  return (
    <SettingsLaunchContext.Provider value={value}>
      {children}
      {preview && !isSettingsPath(pathname) && (
        <SettingsLocalPreview
          onClose={() => {
            cancelPendingRoute();
            preview.metric?.markSettledAfterFrame();
            setPreview(null);
          }}
          preview={preview}
        />
      )}
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
