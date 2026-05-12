"use client";

import { Gear, Keyboard } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
import { useKeyboardHelp } from "@/contexts/keyboard-help";
import { useNavigation } from "@/contexts/navigation";
import { getKeymap } from "@/lib/keymap-defs";
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

export function AppSidebar({ username }: { username: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nav = useNavigation();
  const { openKeyboardHelp } = useKeyboardHelp();
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
                      {getKeymap(view.keymapId).triggerKey}
                    </kbd>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton type="button" onClick={openKeyboardHelp}>
              <Keyboard className="size-4" />
              <span className="flex-1">shortcuts</span>
              <kbd className="text-[10px] text-muted-foreground">g?</kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href={settingsUrl} />}
              isActive={isSettingsPath(pathname)}
              onClick={() => nav.pushJump()}
            >
              <Gear className="size-4" />
              <span className="flex-1">{username}</span>
              <kbd className="text-[10px] text-muted-foreground">
                {getKeymap("global.settings").triggerKey}
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
