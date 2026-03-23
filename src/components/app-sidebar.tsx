"use client";

import {
  Calendar,
  Columns3,
  type LucideIcon,
  Palette,
  Plus,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { createTaskAction } from "@/app/actions/tasks";
import { CategoryColorPicker } from "@/components/category-color-picker";
import { Input } from "@/components/ui/input";
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
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAdd() {
    const name = newCat.trim();
    if (name && !categories.includes(name)) {
      createTaskAction({ description: `New ${name} task`, category: name });
    }
    setNewCat("");
    setAdding(false);
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
          <div className="flex h-8 shrink-0 items-center justify-between px-2">
            <span className="text-xs font-medium text-sidebar-foreground/70">
              Categories
            </span>
            <button
              type="button"
              className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => {
                setAdding(true);
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
            >
              <Plus className="size-3.5" />
            </button>
          </div>
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
              {adding && (
                <SidebarMenuItem>
                  <Input
                    ref={inputRef}
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                    onBlur={handleAdd}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAdd();
                      if (e.key === "Escape") {
                        setNewCat("");
                        setAdding(false);
                      }
                      e.stopPropagation();
                    }}
                    placeholder="category name"
                    className="h-8 text-sm mx-2 w-auto"
                  />
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
