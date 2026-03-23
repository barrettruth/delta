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

const viewRoutes = ["/queue", "/", "/kanban", "/calendar", "/settings"];

export function GlobalKeyboard() {
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

      const viewIndex = Number(e.key) - 1;
      if (viewIndex >= 0 && viewIndex < viewRoutes.length) {
        e.preventDefault();
        router.push(viewRoutes[viewIndex]);
      }
    },
    [router, toggleSidebar],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);

  return null;
}
