"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { useCommandBar } from "@/contexts/command-bar";
import { useKeymaps } from "@/contexts/keymaps";
import { useNavigation } from "@/contexts/navigation";
import { useTaskPanel } from "@/contexts/task-panel";
import { useUndo } from "@/contexts/undo";
import { focusSectionForPath } from "@/lib/keymap-defs";
import { isBrowserShortcut, isInputFocused } from "@/lib/utils";

const DIGIT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function GlobalKeyboard({ categories = [] }: { categories?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toggleSidebar } = useSidebar();
  const { pushJump, jumpBack, jumpForward, goAlternate } = useNavigation();
  const { undo: performUndo } = useUndo();
  const panel = useTaskPanel();
  const commandBar = useCommandBar();
  const keymaps = useKeymaps();
  const pendingG = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openHelp = useCallback(() => {
    const focus = focusSectionForPath(pathname);
    pushJump();
    router.push(`/settings/keymaps?focus=${focus}`);
  }, [pathname, pushJump, router]);

  const viewKeys = useMemo(() => {
    const map: Record<string, string> = {};
    map[keymaps.getResolvedKeymap("global.queue").triggerKey] = "/?view=queue";
    map[keymaps.getResolvedKeymap("global.kanban").triggerKey] = "/kanban";
    map[keymaps.getResolvedKeymap("global.calendar").triggerKey] = "/calendar";
    map[keymaps.getResolvedKeymap("global.settings").triggerKey] = "/settings";
    return map;
  }, [keymaps]);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (isInputFocused()) return;
      if (isBrowserShortcut(e)) return;

      if (
        e.key === ":" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !pendingG.current &&
        !document.querySelector("[role=dialog]")
      ) {
        e.preventDefault();
        commandBar.activate();
        return;
      }

      if (keymaps.resolvedMatchesEvent("nav.jump_back", e)) {
        e.preventDefault();
        jumpBack();
        return;
      }
      if (keymaps.resolvedMatchesEvent("nav.jump_forward", e)) {
        e.preventDefault();
        jumpForward();
        return;
      }
      if (keymaps.resolvedMatchesEvent("nav.alternate", e)) {
        e.preventDefault();
        goAlternate();
        return;
      }

      if (pendingG.current) {
        const isModifier = ["Shift", "Control", "Alt", "Meta"].includes(e.key);
        if (isModifier) return;

        e.preventDefault();
        const key = e.key;
        pendingG.current = false;
        if (gTimer.current) {
          clearTimeout(gTimer.current);
          gTimer.current = null;
        }

        const catIdx = DIGIT_KEYS.indexOf(key);
        if (catIdx !== -1 && catIdx < categories.length) {
          pushJump();
          router.push(`/?category=${encodeURIComponent(categories[catIdx])}`);
        } else if (key === "?") {
          openHelp();
        } else if (key === "c") {
          panel.create();
        } else if (key === ".") {
          const params = new URLSearchParams(searchParams.toString());
          if (params.has("showDone")) {
            params.delete("showDone");
          } else {
            params.set("showDone", "1");
          }
          const qs = params.toString();
          router.push(qs ? `${pathname}?${qs}` : pathname);
          router.refresh();
        }
        return;
      }

      const gTrigger = keymaps.getResolvedKeymap("global.help").triggerKey;
      if (
        e.key === gTrigger &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        pendingG.current = true;
        if (gTimer.current) clearTimeout(gTimer.current);
        gTimer.current = setTimeout(() => {
          pendingG.current = false;
          gTimer.current = null;
        }, 500);
        return;
      }

      const sidebarKey = keymaps.getResolvedKeymap(
        "global.toggle_sidebar",
      ).triggerKey;
      if (e.key === sidebarKey && !document.querySelector("[role=dialog]")) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      const logoutKey = keymaps.getResolvedKeymap("global.logout").triggerKey;
      if (e.key === logoutKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        fetch("/api/auth/logout", { method: "POST" }).then(() => {
          router.push("/login");
        });
        return;
      }

      const weekKey = keymaps.getResolvedKeymap(
        "global.calendar_week",
      ).triggerKey;
      if (
        e.key === weekKey &&
        pathname !== "/calendar" &&
        pathname !== "/kanban"
      ) {
        e.preventDefault();
        pushJump();
        router.push("/calendar?mode=week");
        return;
      }
      const monthKey = keymaps.getResolvedKeymap(
        "global.calendar_month",
      ).triggerKey;
      if (
        e.key === monthKey &&
        pathname !== "/calendar" &&
        pathname !== "/kanban"
      ) {
        e.preventDefault();
        pushJump();
        router.push("/calendar?mode=month");
        return;
      }

      const undoKey = keymaps.getResolvedKeymap("global.undo").triggerKey;
      if (e.key === undoKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        performUndo();
        return;
      }

      const viewRoute = viewKeys[e.key];
      if (viewRoute) {
        e.preventDefault();
        pushJump();
        router.push(viewRoute);
        return;
      }
    },
    [
      router,
      pathname,
      searchParams,
      toggleSidebar,
      categories,
      pushJump,
      jumpBack,
      jumpForward,
      goAlternate,
      performUndo,
      panel,
      commandBar,
      keymaps,
      viewKeys,
      openHelp,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);

  useEffect(() => {
    window.addEventListener("open-keymap-help", openHelp);
    return () => window.removeEventListener("open-keymap-help", openHelp);
  }, [openHelp]);

  useEffect(() => {
    return () => {
      if (gTimer.current) clearTimeout(gTimer.current);
    };
  }, []);

  return null;
}
