"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { useKeyboardHelp } from "@/contexts/keyboard-help";
import { useNavigation } from "@/contexts/navigation";
import { useSettingsLauncher } from "@/contexts/settings-launcher";
import { useTaskPanel } from "@/contexts/task-panel";
import { useUndo } from "@/contexts/undo";
import { registerScopedKeydown } from "@/lib/keyboard";
import { getKeymap, matchesEvent } from "@/lib/keymap-defs";
import { settingsEntryHrefForPath } from "@/lib/settings-navigation";
import { startShortcutPerf } from "@/lib/shortcut-perf";

const DIGIT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const LEADER_TIMEOUT_MS = 1200;

export function GlobalKeyboard({ categories = [] }: { categories?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toggleSidebar } = useSidebar();
  const { pushJump, jumpBack, jumpForward, goAlternate } = useNavigation();
  const { undo: performUndo } = useUndo();
  const panel = useTaskPanel();
  const { openKeyboardHelp } = useKeyboardHelp();
  const { openSettings } = useSettingsLauncher();
  const pendingG = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openHelp = useCallback(() => {
    const metric = startShortcutPerf("help", "g?");
    openKeyboardHelp();
    metric.markVisibleAfterFrame();
    metric.markSettledAfterFrame();
  }, [openKeyboardHelp]);

  const viewKeys = useMemo(() => {
    const map: Record<string, string> = {};
    map[getKeymap("global.queue").triggerKey] = "/?view=queue";
    map[getKeymap("global.kanban").triggerKey] = "/kanban";
    map[getKeymap("global.calendar").triggerKey] = "/calendar";
    map[getKeymap("global.settings").triggerKey] = settingsEntryHrefForPath(
      pathname,
      searchParams,
    );
    return map;
  }, [pathname, searchParams]);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (matchesEvent("nav.jump_back", e)) {
        e.preventDefault();
        jumpBack();
        return;
      }
      if (matchesEvent("nav.jump_forward", e)) {
        e.preventDefault();
        jumpForward();
        return;
      }
      if (matchesEvent("nav.alternate", e)) {
        e.preventDefault();
        goAlternate();
        return;
      }

      if (pendingG.current) {
        const key = e.key;
        pendingG.current = false;
        if (gTimer.current) {
          clearTimeout(gTimer.current);
          gTimer.current = null;
        }

        const catIdx = DIGIT_KEYS.indexOf(key);
        if (catIdx !== -1 && catIdx < categories.length) {
          e.preventDefault();
          pushJump();
          router.push(`/?category=${encodeURIComponent(categories[catIdx])}`);
        } else if (key === "?") {
          e.preventDefault();
          openHelp();
        } else if (key === "c") {
          e.preventDefault();
          const metric = startShortcutPerf("task.create", "gc");
          panel.create();
          metric.markVisibleAfterFrame();
          metric.markSettledAfterFrame();
        } else if (key === ".") {
          e.preventDefault();
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

      const gTrigger = getKeymap("global.help").triggerKey;
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
        }, LEADER_TIMEOUT_MS);
        return;
      }

      const sidebarKey = getKeymap("global.toggle_sidebar").triggerKey;
      if (e.key === sidebarKey) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      const dayKey = getKeymap("global.calendar_day").triggerKey;
      if (
        e.key === dayKey &&
        pathname !== "/calendar" &&
        pathname !== "/kanban"
      ) {
        e.preventDefault();
        pushJump();
        router.push("/calendar?mode=day");
        return;
      }
      const weekKey = getKeymap("global.calendar_week").triggerKey;
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
      const monthKey = getKeymap("global.calendar_month").triggerKey;
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

      const undoKey = getKeymap("global.undo").triggerKey;
      if (e.key === undoKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        performUndo();
        return;
      }

      const viewRoute = viewKeys[e.key];
      if (viewRoute) {
        e.preventDefault();
        pushJump();
        if (e.key === getKeymap("global.settings").triggerKey) {
          openSettings(viewRoute, startShortcutPerf("settings", e.key));
          return;
        }
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
      viewKeys,
      openHelp,
      openSettings,
    ],
  );

  useEffect(() => {
    return registerScopedKeydown(
      window,
      { scope: "global", taskPanelOpen: panel.isOpen },
      handler,
    );
  }, [handler, panel.isOpen]);

  useEffect(() => {
    return () => {
      if (gTimer.current) clearTimeout(gTimer.current);
    };
  }, []);

  return null;
}
