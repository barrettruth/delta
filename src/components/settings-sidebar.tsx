"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useStatusBar } from "@/contexts/status-bar";
import { isInputFocused } from "@/lib/utils";

const SECTIONS = [
  { id: "account", label: "account", href: "/settings" },
  { id: "security", label: "security", href: "/settings/security" },
  { id: "keymaps", label: "keymaps", href: "/settings/keymaps" },
  { id: "integrations", label: "integrations", href: "/settings/integrations" },
  { id: "preferences", label: "preferences", href: "/settings/preferences" },
  { id: "invites", label: "invites", href: "/settings/invites" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/settings") return pathname === "/settings";
  return pathname.startsWith(href);
}

export function SettingsSidebar({ username }: { username: string }) {
  const pathname = usePathname();
  const statusBar = useStatusBar();
  const [cursor, setCursor] = useState(() => {
    const idx = SECTIONS.findIndex((s) => isActive(pathname, s.href));
    return idx >= 0 ? idx : 0;
  });
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const idx = SECTIONS.findIndex((s) => isActive(pathname, s.href));
    if (idx >= 0) setCursor(idx);
    const section = idx >= 0 ? SECTIONS[idx].label : "account";
    statusBar.setIdle(`-- SETTINGS -- ${section}`, "");
  }, [pathname, statusBar.setIdle]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (isInputFocused()) return;

      if (e.key === "j") {
        e.preventDefault();
        setCursor((prev) => {
          const next = Math.min(prev + 1, SECTIONS.length - 1);
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
    <nav className="w-48 shrink-0 border-r border-border/60 flex flex-col py-4">
      <div className="px-4 pb-4 text-xs text-muted-foreground/60 uppercase tracking-wider">
        {username}
      </div>
      {SECTIONS.map((section, i) => {
        const active = isActive(pathname, section.href);
        return (
          <Link
            key={section.id}
            ref={(el) => {
              linkRefs.current[i] = el;
            }}
            href={section.href}
            className={`block px-4 py-1.5 text-sm transition-colors ${
              active
                ? "text-foreground bg-accent"
                : cursor === i
                  ? "text-foreground bg-accent/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
