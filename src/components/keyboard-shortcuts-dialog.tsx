"use client";

import { useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { registerScopedKeydown } from "@/lib/keyboard";
import { HELP_SECTIONS, SECTION_LABELS } from "@/lib/keymap-defs";

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "q") return;
      e.preventDefault();
      close();
    }
    return registerScopedKeydown(window, { scope: "dialog" }, handleKeyDown);
  }, [close, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[min(680px,calc(100vh-1rem))] w-[min(760px,calc(100vw-1rem))] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden bg-popover p-0 text-xs">
        <DialogHeader className="h-9 shrink-0 justify-center border-b border-border/60 px-4 pr-10">
          <DialogTitle className="font-mono text-[11px] font-medium uppercase text-muted-foreground">
            keyboard
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
          <div className="grid gap-4 md:grid-cols-2">
            {HELP_SECTIONS.map((section) => (
              <section key={section.section} className="min-w-0 space-y-2">
                <h2 className="px-0.5 font-mono text-[10px] uppercase text-muted-foreground/70">
                  {SECTION_LABELS[section.section]}
                </h2>
                <div className="divide-y divide-border/40 border-y border-border/40">
                  {section.rows.map((row) => (
                    <div
                      key={`${section.section}-${row.keyDisplay}-${row.label}`}
                      className="grid min-h-7 grid-cols-[minmax(4.75rem,max-content)_1fr] items-center gap-3 px-2 py-1.5"
                    >
                      <kbd className="min-w-16 max-w-32 border border-border bg-muted/40 px-1.5 py-0.5 text-center font-mono text-[11px] leading-tight text-foreground break-words">
                        {row.keyDisplay}
                      </kbd>
                      <span className="min-w-0 text-muted-foreground">
                        {row.label}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="flex h-8 shrink-0 items-center justify-between border-t border-border/60 px-4 font-mono text-[10px] text-muted-foreground">
          <span>g?</span>
          <span>q / esc close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
