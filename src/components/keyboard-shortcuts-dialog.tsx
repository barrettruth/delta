"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { registerScopedKeydown } from "@/lib/keyboard";
import { helpSectionsForPath, SECTION_LABELS } from "@/lib/keymap-defs";

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const sections = helpSectionsForPath(pathname);
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
      <DialogContent className="flex max-h-[calc(100vh-1rem)] w-[min(900px,calc(100vw-1rem))] max-w-none flex-col gap-0 overflow-hidden bg-popover p-0 text-sm sm:max-w-none">
        <DialogHeader className="h-10 shrink-0 justify-center border-b border-border/60 px-5 pr-10">
          <DialogTitle className="font-mono text-xs font-medium uppercase text-muted-foreground">
            keyboard
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
          <div className="grid gap-5 md:grid-cols-2">
            {sections.map((section) => (
              <section key={section.section} className="min-w-0 space-y-2.5">
                <h2 className="px-0.5 font-mono text-[11px] uppercase text-muted-foreground/70">
                  {SECTION_LABELS[section.section]}
                </h2>
                <div className="divide-y divide-border/40 border-y border-border/40">
                  {section.rows.map((row) => (
                    <div
                      key={`${section.section}-${row.keyDisplay}-${row.label}`}
                      className="grid min-h-8 grid-cols-[max-content_minmax(0,1fr)] items-center gap-3 px-2 py-2"
                    >
                      <kbd className="inline-flex w-fit max-w-[40vw] justify-self-start border border-border bg-muted/40 px-1.5 py-0.5 text-center font-mono text-xs leading-tight text-foreground break-words sm:max-w-40">
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

        <div className="flex h-9 shrink-0 items-center justify-between border-t border-border/60 px-5 font-mono text-[11px] text-muted-foreground">
          <span>g?</span>
          <span>q / esc close</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
