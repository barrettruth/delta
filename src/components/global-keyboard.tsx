"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { KeymapHelp } from "@/components/keymap-help";
import { useSidebar } from "@/components/ui/sidebar";
import { isInputFocused } from "@/lib/utils";

const VIEW_KEYS: Record<string, string> = {
  Q: "/",
  K: "/kanban",
  C: "/calendar",
};
const CATEGORY_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function GlobalKeyboard({ categories = [] }: { categories?: string[] }) {
  const router = useRouter();
  const { toggleSidebar } = useSidebar();
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingG = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      if (pendingG.current && e.key === "?") {
        e.preventDefault();
        pendingG.current = false;
        if (gTimer.current) {
          clearTimeout(gTimer.current);
          gTimer.current = null;
        }
        setHelpOpen(true);
        return;
      }

      if (e.key === "g" && !e.shiftKey) {
        pendingG.current = true;
        if (gTimer.current) clearTimeout(gTimer.current);
        gTimer.current = setTimeout(() => {
          pendingG.current = false;
          gTimer.current = null;
        }, 500);
        return;
      }

      if (pendingG.current) {
        pendingG.current = false;
        if (gTimer.current) {
          clearTimeout(gTimer.current);
          gTimer.current = null;
        }
      }

      if (e.key === "-" && !document.querySelector("[role=dialog]")) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      if (e.key === "q") {
        e.preventDefault();
        fetch("/api/auth/logout", { method: "POST" }).then(() => {
          router.push("/login");
        });
        return;
      }

      const viewRoute = VIEW_KEYS[e.key];
      if (viewRoute) {
        e.preventDefault();
        router.push(viewRoute);
        return;
      }

      const catIdx = CATEGORY_KEYS.indexOf(e.key);
      if (catIdx !== -1 && catIdx < categories.length) {
        e.preventDefault();
        router.push(`/?category=${encodeURIComponent(categories[catIdx])}`);
      }
    },
    [router, toggleSidebar, categories],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);

  useEffect(() => {
    return () => {
      if (gTimer.current) clearTimeout(gTimer.current);
    };
  }, []);

  return <KeymapHelp open={helpOpen} onClose={() => setHelpOpen(false)} />;
}
