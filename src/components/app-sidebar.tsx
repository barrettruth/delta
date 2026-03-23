"use client";

import {
  Calendar,
  CheckSquare,
  Columns3,
  List,
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
    { label: "Queue", href: "/queue", icon: Zap, key: "1" },
    { label: "List", href: "/", icon: List, key: "2" },
    { label: "Kanban", href: "/kanban", icon: Columns3, key: "3" },
    { label: "Calendar", href: "/calendar", icon: Calendar, key: "4" },
    { label: "Settings", href: "/settings", icon: Settings, key: "5" },
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

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4 border-b border-border/60">
        <Link
          href="/"
          className="flex items-center gap-2 text-foreground hover:text-foreground/80 transition-colors select-none"
        >
          <span className="text-3xl font-serif leading-none">&Delta;</span>
          <span className="text-base font-serif">delta</span>
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
                    <kbd className="text-[10px] font-mono text-muted-foreground">
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
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/" />}
                  isActive={pathname === "/" && !activeCategory}
                >
                  <CheckSquare className="size-4" />
                  <span>All</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {categories.map((cat) => (
                <SidebarMenuItem key={cat}>
                  <div className="flex items-center">
                    <SidebarMenuButton
                      render={
                        <Link href={`/?category=${encodeURIComponent(cat)}`} />
                      }
                      isActive={activeCategory === cat}
                      className="flex-1"
                    >
                      <span
                        className="size-3 rounded-full shrink-0 border border-border/60"
                        style={{
                          backgroundColor:
                            categoryColors[cat] ?? "var(--muted-foreground)",
                        }}
                      />
                      <span className="flex-1">{cat}</span>
                    </SidebarMenuButton>
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-accent transition-colors opacity-0 group-hover/sidebar:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingColor(editingColor === cat ? null : cat);
                      }}
                    >
                      <Palette className="size-3 text-muted-foreground" />
                    </button>
                  </div>
                  {editingColor === cat && (
                    <div className="mt-1 ml-2 rounded-lg border border-border/60 bg-popover shadow-lg">
                      <CategoryColorPicker
                        category={cat}
                        currentColor={categoryColors[cat] ?? null}
                        onClose={() => setEditingColor(null)}
                      />
                    </div>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
