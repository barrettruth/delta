"use client";

import {
  Calendar,
  Columns3,
  type LucideIcon,
  Palette,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { createTaskAction } from "@/app/actions/tasks";
import { CategoryColorPicker } from "@/components/category-color-picker";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const views: { label: string; href: string; icon: LucideIcon; key: string }[] =
  [
    { label: "Queue", href: "/", icon: Zap, key: "Q" },
    { label: "Kanban", href: "/kanban", icon: Columns3, key: "K" },
    { label: "Calendar", href: "/calendar", icon: Calendar, key: "C" },
  ];

export function AppSidebar({
  categories,
  categoryColors,
}: {
  categories: string[];
  categoryColors: Record<string, string>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");
  const [editingColor, setEditingColor] = useState<string | null>(null);
  const [newCat, setNewCat] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const name = newCat.trim();
    if (name && !categories.includes(name)) {
      createTaskAction({ description: `New ${name} task`, category: name });
    }
    setNewCat("");
  }

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4 border-b border-border/60">
        <Link
          href="/"
          className="flex items-center gap-2 text-foreground hover:text-foreground/80 transition-colors select-none"
        >
          <span className="text-3xl font-serif leading-none">&Delta;</span>
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
                      >
                        <span
                          className="text-xs font-bold shrink-0"
                          style={{
                            color:
                              categoryColors[cat] ?? "var(--muted-foreground)",
                          }}
                        >
                          #
                        </span>
                        <span className="flex-1">{cat}</span>
                        {shortcutKey && (
                          <kbd className="text-[10px] text-muted-foreground">
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
              <SidebarMenuItem>
                <input
                  ref={inputRef}
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                    if (e.key === "Escape") {
                      setNewCat("");
                      inputRef.current?.blur();
                    }
                    e.stopPropagation();
                  }}
                  placeholder="new category..."
                  className="w-full h-8 px-2 text-sm bg-transparent text-muted-foreground placeholder:text-muted-foreground/40 outline-none"
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
