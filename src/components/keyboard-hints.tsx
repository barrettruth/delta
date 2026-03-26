"use client";

import { useUndo } from "@/contexts/undo";

export function MessageBar() {
  const { message } = useUndo();

  return (
    <div className="h-7 px-4 flex items-center text-xs text-muted-foreground border-t border-border/40">
      {message}
    </div>
  );
}
