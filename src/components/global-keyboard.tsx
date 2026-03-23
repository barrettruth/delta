"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useSidebar } from "@/components/ui/sidebar";

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (el as HTMLElement).isContentEditable
  );
}

const viewRoutes = ["/", "/kanban", "/calendar", "/settings"];
const CATEGORY_KEYS = ["5", "6", "7", "8", "9"];

export function GlobalKeyboard({ categories = [] }: { categories?: string[] }) {
  const router = useRouter();
  const { toggleSidebar } = useSidebar();

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (isInputFocused()) return;

      if (e.key === "b") {
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

      const catIdx = CATEGORY_KEYS.indexOf(e.key);
      if (catIdx !== -1 && catIdx < categories.length) {
        e.preventDefault();
        router.push(`/?category=${encodeURIComponent(categories[catIdx])}`);
        return;
      }

      const viewIndex = Number(e.key) - 1;
      if (viewIndex >= 0 && viewIndex < viewRoutes.length) {
        e.preventDefault();
        router.push(viewRoutes[viewIndex]);
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
