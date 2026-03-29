"use client";

import { useStatusBar } from "@/contexts/status-bar";

export function StatusBar() {
  const { current, operation } = useStatusBar();

  const display =
    current ??
    (operation ? { text: operation.text, type: "message" as const } : null);

  return (
    <div className="h-7 shrink-0 border-t border-border/60 flex items-center px-4 text-xs">
      {display && (
        <span
          className={
            display.type === "error"
              ? "text-destructive"
              : "text-muted-foreground"
          }
        >
          {display.text}
        </span>
      )}
    </div>
  );
}
