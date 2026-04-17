"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { useStatusBar } from "@/contexts/status-bar";
import {
  getActiveSettingsIndex,
  SETTINGS_RETURN_TO_PARAM,
  SETTINGS_SECTIONS,
  safeSettingsReturnTo,
  settingsHref,
} from "@/lib/settings-navigation";
import { isInputFocused } from "@/lib/utils";

export function SettingsModalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusBar = useStatusBar();
  const returnTo = safeSettingsReturnTo(
    searchParams.get(SETTINGS_RETURN_TO_PARAM),
  );

  const activeIndex = useMemo(
    () => getActiveSettingsIndex(pathname),
    [pathname],
  );
  const activeSection = SETTINGS_SECTIONS[activeIndex];
  const sectionHref = useCallback(
    (href: string) => settingsHref(href, returnTo),
    [returnTo],
  );

  const close = useCallback(() => {
    router.replace(returnTo);
  }, [returnTo, router]);

  const navigateToSection = useCallback(
    (index: number) =>
      router.replace(sectionHref(SETTINGS_SECTIONS[index].href)),
    [router, sectionHref],
  );

  useEffect(() => {
    statusBar.setIdle(
      `-- SETTINGS -- ${activeSection.label}`,
      "q · esc  close",
    );
    return () => statusBar.setIdle("", "");
  }, [activeSection.label, statusBar.setIdle]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (isInputFocused()) return;
        e.preventDefault();
        close();
        return;
      }

      if (isInputFocused()) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === "q") {
        e.preventDefault();
        close();
        return;
      }

      const numeric = Number.parseInt(e.key, 10);
      if (
        !Number.isNaN(numeric) &&
        numeric >= 1 &&
        numeric <= SETTINGS_SECTIONS.length
      ) {
        e.preventDefault();
        navigateToSection(numeric - 1);
        return;
      }

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(activeIndex + 1, SETTINGS_SECTIONS.length - 1);
        navigateToSection(next);
        return;
      }

      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(activeIndex - 1, 0);
        navigateToSection(prev);
        return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, close, navigateToSection]);

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
      modal
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="
            fixed inset-0 z-40 bg-background/70 backdrop-blur-[3px]
            duration-150
            data-open:animate-in data-open:fade-in-0
            data-closed:animate-out data-closed:fade-out-0
          "
        />
        <DialogPrimitive.Popup
          aria-label="settings"
          className="
            fixed top-1/2 left-1/2 z-50
            -translate-x-1/2 -translate-y-1/2
            w-[min(1120px,calc(100vw-1.5rem))]
            h-[min(720px,calc(100vh-1.5rem))]
            flex flex-col md:flex-row
            bg-popover border border-border
            shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)]
            outline-none overflow-hidden
            duration-150
            data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98]
            data-closed:animate-out data-closed:fade-out-0
          "
        >
          <SettingsNavRail
            activeHref={activeSection.href}
            sectionHref={sectionHref}
          />

          <div className="flex flex-1 min-w-0 min-h-0 flex-col">
            <div className="flex items-center justify-between h-8 shrink-0 border-b border-border/60 pl-4 pr-1">
              <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">
                settings
              </span>
              <button
                type="button"
                onClick={close}
                aria-label="close settings"
                className="
                  flex size-6 items-center justify-center
                  text-muted-foreground hover:text-foreground
                  hover:bg-muted/60
                  transition-colors cursor-pointer
                "
              >
                <X size={13} weight="bold" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SettingsNavRail({
  activeHref,
  sectionHref,
}: {
  activeHref: string;
  sectionHref: (href: string) => string;
}) {
  return (
    <nav
      className="
        flex shrink-0 min-h-0
        flex-row md:flex-col
        md:w-52
        md:border-r border-b md:border-b-0 border-border/60
        bg-background/30
      "
    >
      <div
        className="
          flex flex-row md:flex-col
          w-full overflow-x-auto md:overflow-x-visible
          no-scrollbar
        "
      >
        {SETTINGS_SECTIONS.map((section, i) => {
          const active = section.href === activeHref;
          return (
            <Link
              key={section.id}
              href={sectionHref(section.href)}
              replace
              aria-current={active ? "page" : undefined}
              className={`
                group relative flex shrink-0 items-center gap-2
                md:w-full
                px-4 py-2 md:py-1.5 text-sm
                border-l-2
                transition-colors outline-none
                ${
                  active
                    ? "bg-muted text-foreground border-foreground/70 font-medium"
                    : "border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground focus-visible:bg-muted/30"
                }
              `}
            >
              <span className="flex-1 truncate">{section.label}</span>
              <kbd
                className={`
                  hidden md:inline-block
                  font-mono text-[10px] shrink-0 tabular-nums
                  ${
                    active
                      ? "text-muted-foreground"
                      : "text-muted-foreground/40 group-hover:text-muted-foreground"
                  }
                `}
              >
                {i + 1}
              </kbd>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
