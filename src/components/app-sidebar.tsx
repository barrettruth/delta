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

const views: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Queue", href: "/queue", icon: Zap },
  { label: "List", href: "/", icon: List },
  { label: "Kanban", href: "/kanban", icon: Columns3 },
  { label: "Calendar", href: "/calendar", icon: Calendar },
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
          className="flex items-center gap-2 text-2xl font-bold tracking-tight text-primary hover:text-primary/80 transition-colors select-none"
        >
          <span className="text-3xl leading-none">&Delta;</span>
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
                    <span>{view.label}</span>
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
