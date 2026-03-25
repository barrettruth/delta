"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CreateTaskDrawer } from "@/components/create-task-drawer";
import { KeymapHelp } from "@/components/keymap-help";
import { useSidebar } from "@/components/ui/sidebar";
import { useNavigation } from "@/contexts/navigation";
import { isInputFocused } from "@/lib/utils";

const VIEW_KEYS: Record<string, string> = {
  Q: "/",
  K: "/kanban",
  C: "/calendar",
};
const DIGIT_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function GlobalKeyboard({
  categories = [],
  defaultCategory,
}: {
  categories?: string[];
  defaultCategory?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toggleSidebar } = useSidebar();
  const { pushJump, jumpBack, jumpForward, goAlternate } = useNavigation();
  const [helpOpen, setHelpOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const pendingG = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const calendarDate = pathname === "/calendar" ? undefined : undefined;

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      if (e.ctrlKey) {
        if (e.key === "o") {
          e.preventDefault();
          jumpBack();
          return;
        }
        if (e.key === "i") {
          e.preventDefault();
          jumpForward();
          return;
        }
        if (e.key === "6") {
          e.preventDefault();
          goAlternate();
          return;
        }
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
          setCreateOpen(true);
        } else if (key === ".") {
          const params = new URLSearchParams(searchParams.toString());
          if (params.has("showDone")) {
            params.delete("showDone");
          } else {
            params.set("showDone", "1");
          }
          const qs = params.toString();
          router.push(qs ? `${pathname}?${qs}` : pathname);
        }
        return;
      }

      if (
        e.key === "g" &&
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

      if (e.key === "-" && !document.querySelector("[role=dialog]")) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      if (e.key === "q" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        fetch("/api/auth/logout", { method: "POST" }).then(() => {
          router.push("/login");
        });
        return;
      }

      if (e.key === "w" && pathname !== "/calendar") {
        e.preventDefault();
        pushJump();
        router.push("/calendar?mode=week");
        return;
      }
      if (e.key === "m" && pathname !== "/calendar") {
        e.preventDefault();
        pushJump();
        router.push("/calendar?mode=month");
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
    const open = () => setCreateOpen(true);
    window.addEventListener("open-create-task", open);
    return () => window.removeEventListener("open-create-task", open);
  }, []);

  useEffect(() => {
    return () => {
      if (gTimer.current) clearTimeout(gTimer.current);
    };
  }, []);

  return (
    <>
      <KeymapHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <CreateTaskDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        categories={categories}
        defaultCategory={defaultCategory}
        defaultDue={calendarDate}
      />
    </>
  );
}
