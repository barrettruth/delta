"use client";

import {
  Calendar,
  CheckSquare,
  Columns3,
  List,
  type LucideIcon,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
  ];

export function AppSidebar({ categories }: { categories: string[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4 border-b border-border/60">
        <Link
          href="/"
          className="flex items-center gap-2 text-foreground hover:text-foreground/80 transition-colors select-none"
        >
          <span className="text-3xl font-serif leading-none">&Delta;</span>
          <span className="text-sm font-medium text-muted-foreground">
            delta
          </span>
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
                  <SidebarMenuButton
                    render={
                      <Link href={`/?category=${encodeURIComponent(cat)}`} />
                    }
                    isActive={activeCategory === cat}
                  >
                    <CheckSquare className="size-4" />
                    <span>{cat}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
