"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
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

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      if (e.key === "b" && !document.querySelector("[role=dialog]")) {
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

  return null;
}
