"use client";

import { useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isInputFocused } from "@/lib/utils";

export type RecurrenceStrategy = "this" | "this-and-future" | "all";

export function RecurrenceStrategyDialog({
  open,
  onOpenChange,
  mode,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "edit" | "delete";
  onSelect: (strategy: RecurrenceStrategy) => void;
}) {
  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "1") {
        e.preventDefault();
        onSelect("this");
      } else if (e.key === "2") {
        e.preventDefault();
        onSelect("this-and-future");
      } else if (e.key === "3") {
        e.preventDefault();
        onSelect("all");
      }
    },
    [open, onSelect],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, handleKey]);

  const label = mode === "edit" ? "Edit" : "Delete";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{label} recurring task</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="flex items-center gap-3 px-3 py-2 text-xs text-left hover:bg-accent transition-colors"
            onClick={() => onSelect("this")}
          >
            <span className="text-muted-foreground font-mono">1</span>
            {label} this instance
          </button>
          <button
            type="button"
            className="flex items-center gap-3 px-3 py-2 text-xs text-left hover:bg-accent transition-colors"
            onClick={() => onSelect("this-and-future")}
          >
            <span className="text-muted-foreground font-mono">2</span>
            {label} this & future
          </button>
          <button
            type="button"
            className="flex items-center gap-3 px-3 py-2 text-xs text-left hover:bg-accent transition-colors"
            onClick={() => onSelect("all")}
          >
            <span className="text-muted-foreground font-mono">3</span>
            {label} all instances
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
