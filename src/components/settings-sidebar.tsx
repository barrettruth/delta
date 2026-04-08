"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useStatusBar } from "@/contexts/status-bar";
import {
  isSettingsSectionActive,
  SETTINGS_SECTIONS,
} from "@/lib/settings-navigation";

export function SettingsSidebar({ username }: { username: string }) {
  const pathname = usePathname();
  const statusBar = useStatusBar();

  useEffect(() => {
    const idx = SETTINGS_SECTIONS.findIndex((s) =>
      isSettingsSectionActive(pathname, s.href),
    );
    const section = idx >= 0 ? SETTINGS_SECTIONS[idx].label : "account";
    statusBar.setIdle(`-- SETTINGS -- ${section}`, "");
  }, [pathname, statusBar.setIdle]);

  return (
    <nav className="w-full shrink-0 border-b border-border/60 bg-muted/10 px-3 py-3 md:w-60 md:border-b-0 md:border-r md:px-3 md:py-4">
      <div className="flex items-center justify-between gap-3 px-2 pb-3 md:block md:pb-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/60">
          settings
        </div>
        <div className="truncate text-sm text-foreground md:mt-2">
          {username}
        </div>
      </div>
      <div className="no-scrollbar overflow-x-auto md:overflow-visible">
        <div className="flex gap-1 md:flex-col md:gap-1">
          {SETTINGS_SECTIONS.map((section) => {
            const active = isSettingsSectionActive(pathname, section.href);

            return (
              <Link
                key={section.id}
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center rounded-lg px-2.5 py-2 text-sm outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring md:w-full ${
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                }`}
              >
                <span className="truncate">{section.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
