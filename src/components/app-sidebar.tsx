"use client";

import { Gear, Palette } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CategoryColorPicker } from "@/components/category-color-picker";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useKeymaps } from "@/contexts/keymaps";
import { useNavigation } from "@/contexts/navigation";
import {
  isSettingsPath,
  settingsHref,
  settingsReturnToForPath,
} from "@/lib/settings-navigation";

const VIEW_KEYMAP_IDS: {
  label: string;
  href: string;
  keymapId: string;
}[] = [
  { label: "Queue", href: "/?view=queue", keymapId: "global.queue" },
  { label: "kanban", href: "/kanban", keymapId: "global.kanban" },
  { label: "Calendar", href: "/calendar", keymapId: "global.calendar" },
];

export function AppSidebar({
  username,
  categories,
  categoryColors,
}: {
  username: string;
  categories: string[];
  categoryColors: Record<string, string>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");
  const nav = useNavigation();
  const keymaps = useKeymaps();
  const [editingColor, setEditingColor] = useState<string | null>(null);
  const settingsUrl = settingsHref(
    "/settings",
    settingsReturnToForPath(pathname, searchParams),
  );

  return (
    <Sidebar>
      <SidebarHeader className="h-16 shrink-0 flex-row items-center gap-2 p-0 px-4 border-b border-border/60">
        <Link
          href="/"
          className="flex items-baseline gap-0.5 text-foreground hover:text-foreground/80 transition-colors select-none"
        >
          <span className="text-2xl font-serif leading-none">&delta;</span>
          <span className="text-xl leading-none">elta</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Views</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {VIEW_KEYMAP_IDS.map((view) => (
                <SidebarMenuItem key={view.href}>
                  <SidebarMenuButton
                    render={<Link href={view.href} />}
                    isActive={
                      view.href.startsWith("/?")
                        ? pathname === "/"
                        : pathname === view.href
                    }
                    onClick={() => nav.pushJump()}
                  >
                    <span className="flex-1">{view.label}</span>
                    <kbd className="text-[10px] text-muted-foreground">
                      {keymaps.getResolvedKeymap(view.keymapId).triggerKey}
                    </kbd>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Categories</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {categories.map((cat, idx) => {
                const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
                const shortcutKey = idx < KEYS.length ? KEYS[idx] : null;
                return (
                  <SidebarMenuItem key={cat}>
                    <div className="relative">
                      <SidebarMenuButton
                        render={
                          <Link
                            href={`/?category=${encodeURIComponent(cat)}`}
                          />
                        }
                        isActive={activeCategory === cat}
                        onClick={() => nav.pushJump()}
                      >
                        <span className="text-xs font-bold shrink-0 text-muted-foreground">
                          #
                        </span>
                        <span className="flex-1">{cat}</span>
                        {shortcutKey && (
                          <kbd className="text-[10px] text-muted-foreground">
                            {
                              keymaps.getResolvedKeymap("global.category_jump")
                                .triggerKey
                            }
                            {shortcutKey}
                          </kbd>
                        )}
                      </SidebarMenuButton>
                      <button
                        type="button"
                        className="absolute right-0 top-1/2 -translate-y-1/2 p-1 hover:bg-accent transition-colors opacity-0 group-hover/sidebar:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingColor(editingColor === cat ? null : cat);
                        }}
                      >
                        <Palette
                          className="size-3 text-muted-foreground"
                          weight="bold"
                        />
                      </button>
                    </div>
                    {editingColor === cat && (
                      <div className="mt-1 ml-2 border border-border bg-popover">
                        <CategoryColorPicker
                          category={cat}
                          currentColor={categoryColors[cat] ?? null}
                          onClose={() => setEditingColor(null)}
                        />
                      </div>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href={settingsUrl} />}
              isActive={isSettingsPath(pathname)}
              onClick={() => nav.pushJump()}
            >
              <Gear className="size-4" />
              <span className="flex-1">{username}</span>
              <kbd className="text-[10px] text-muted-foreground">
                {keymaps.getResolvedKeymap("global.settings").triggerKey}
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
