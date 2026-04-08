"use client";

import {
  Keyboard,
  PlugsConnected,
  ShieldCheck,
  SlidersHorizontal,
  UserCircle,
  Users,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useStatusBar } from "@/contexts/status-bar";
import {
  isSettingsSectionActive,
  SETTINGS_SECTIONS,
} from "@/lib/settings-navigation";
import { isInputFocused } from "@/lib/utils";

const SECTION_ICONS = {
  account: UserCircle,
  security: ShieldCheck,
  keymaps: Keyboard,
  integrations: PlugsConnected,
  preferences: SlidersHorizontal,
  invites: Users,
} as const;

export function SettingsSidebar({ username }: { username: string }) {
  const pathname = usePathname();
  const statusBar = useStatusBar();
  const [cursor, setCursor] = useState(() => {
    const idx = SETTINGS_SECTIONS.findIndex((s) =>
      isSettingsSectionActive(pathname, s.href),
    );
    return idx >= 0 ? idx : 0;
  });
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const idx = SETTINGS_SECTIONS.findIndex((s) =>
      isSettingsSectionActive(pathname, s.href),
    );
    if (idx >= 0) setCursor(idx);
    const section = idx >= 0 ? SETTINGS_SECTIONS[idx].label : "account";
    statusBar.setIdle(`-- SETTINGS -- ${section}`, "");
  }, [pathname, statusBar.setIdle]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (isInputFocused()) return;

      if (e.key === "j") {
        e.preventDefault();
        setCursor((prev) => {
          const next = Math.min(prev + 1, SETTINGS_SECTIONS.length - 1);
          linkRefs.current[next]?.click();
          return next;
        });
      } else if (e.key === "k") {
        e.preventDefault();
        setCursor((prev) => {
          const next = Math.max(prev - 1, 0);
          linkRefs.current[next]?.click();
          return next;
        });
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

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
          {SETTINGS_SECTIONS.map((section, i) => {
            const active = isSettingsSectionActive(pathname, section.href);
            const Icon = SECTION_ICONS[section.id];
            const highlighted = active || cursor === i;

            return (
              <Link
                key={section.id}
                ref={(el) => {
                  linkRefs.current[i] = el;
                }}
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring md:w-full ${
                  active
                    ? "bg-accent text-foreground"
                    : highlighted
                      ? "bg-accent/50 text-foreground"
                      : "text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                }`}
              >
                <Icon
                  className={`size-4 shrink-0 ${
                    active ? "text-foreground" : "text-muted-foreground"
                  }`}
                  weight={active ? "fill" : "regular"}
                />
                <span className="truncate">{section.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
