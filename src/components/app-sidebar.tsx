"use client";

import {
  Calendar,
  Columns3,
  type LucideIcon,
  Palette,
  Settings,
  Zap,
} from "lucide-react";
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
import { useNavigation } from "@/contexts/navigation";

const views: { label: string; href: string; icon: LucideIcon; key: string }[] =
  [
    { label: "Queue", href: "/", icon: Zap, key: "Q" },
    { label: "Kanban", href: "/kanban", icon: Columns3, key: "K" },
    { label: "Calendar", href: "/calendar", icon: Calendar, key: "C" },
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
  const [editingColor, setEditingColor] = useState<string | null>(null);

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4 border-b border-border/60">
        <Link
          href="/"
          className="flex items-center gap-2 text-foreground hover:text-foreground/80 transition-colors select-none"
        >
          <span className="text-3xl font-serif leading-none">&delta;</span>
          <span className="text-base">delta</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Views</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {views.map((view) => (
                <SidebarMenuItem key={view.href}>
                  <SidebarMenuButton
                    render={<Link href={view.href} />}
                    isActive={pathname === view.href}
                    onClick={() => nav.pushJump()}
                  >
                    <view.icon className="size-4" />
                    <span className="flex-1">{view.label}</span>
                    <kbd className="text-[10px] text-muted-foreground">
                      {view.key}
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
                            g{shortcutKey}
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
                        <Palette className="size-3 text-muted-foreground" />
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
      <SidebarFooter className="border-t border-border/60 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/settings" />}
              isActive={pathname === "/settings"}
              onClick={() => nav.pushJump()}
            >
              <Settings className="size-4" />
              <span className="flex-1">{username}</span>
              <kbd className="text-[10px] text-muted-foreground">S</kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
