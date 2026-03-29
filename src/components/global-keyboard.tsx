"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { KeymapHelp } from "@/components/keymap-help";
import { useSidebar } from "@/components/ui/sidebar";
import { useCommandBar } from "@/contexts/command-bar";
import { useNavigation } from "@/contexts/navigation";
import { useTaskPanel } from "@/contexts/task-panel";
import { useUndo } from "@/contexts/undo";
import { getKeymap, matchesEvent } from "@/lib/keymap-defs";
import { isBrowserShortcut, isInputFocused } from "@/lib/utils";

const VIEW_KEYS: Record<string, string> = {
  [getKeymap("global.queue").key]: "/",
  [getKeymap("global.kanban").key]: "/kanban",
  [getKeymap("global.calendar").key]: "/calendar",
  [getKeymap("global.settings").key]: "/settings",
};
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
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingG = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          setHelpOpen(true);
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

      if (
        e.key === getKeymap("global.help").triggerKey &&
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

      if (
        e.key === getKeymap("global.toggle_sidebar").key &&
        !document.querySelector("[role=dialog]")
      ) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      if (
        e.key === getKeymap("global.logout").key &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        e.preventDefault();
        fetch("/api/auth/logout", { method: "POST" }).then(() => {
          router.push("/login");
        });
        return;
      }

      if (
        e.key === getKeymap("global.calendar_week").key &&
        pathname !== "/calendar" &&
        pathname !== "/kanban"
      ) {
        e.preventDefault();
        pushJump();
        router.push("/calendar?mode=week");
        return;
      }
      if (
        e.key === getKeymap("global.calendar_month").key &&
        pathname !== "/calendar" &&
        pathname !== "/kanban"
      ) {
        e.preventDefault();
        pushJump();
        router.push("/calendar?mode=month");
        return;
      }

      if (e.key === getKeymap("global.undo").key && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        performUndo();
        return;
      }

      const viewRoute = VIEW_KEYS[e.key];
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
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);

  useEffect(() => {
    const open = () => setHelpOpen(true);
    window.addEventListener("open-keymap-help", open);
    return () => window.removeEventListener("open-keymap-help", open);
  }, []);

  useEffect(() => {
    return () => {
      if (gTimer.current) clearTimeout(gTimer.current);
    };
  }, []);

  return <KeymapHelp open={helpOpen} onClose={() => setHelpOpen(false)} />;
}
