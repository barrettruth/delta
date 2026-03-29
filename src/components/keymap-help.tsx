"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { HELP_SECTIONS, SECTION_LABELS } from "@/lib/keymap-defs";

export function KeymapHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className="fixed inset-8 z-50 mx-auto max-w-2xl flex flex-col border border-border bg-card duration-100 outline-none overflow-auto data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          onKeyDown={(e) => {
            if (e.key === "q") {
              e.preventDefault();
              onClose();
            }
          }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
            <span className="text-sm font-medium">Keyboard Shortcuts</span>
            <kbd className="text-[10px] text-muted-foreground">q to close</kbd>
          </div>
          <div className="grid grid-cols-2 gap-6 p-6 overflow-auto">
            {HELP_SECTIONS.map((section) => (
              <div key={section.section}>
                <h3 className="text-xs font-medium text-muted-foreground mb-3">
                  {SECTION_LABELS[section.section]}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {section.rows.map((entry) => (
                    <div
                      key={entry.keyDisplay}
                      className="flex items-center justify-between gap-4"
                    >
                      <kbd className="text-xs text-foreground shrink-0 min-w-16">
                        {entry.keyDisplay}
                      </kbd>
                      <span className="text-xs text-muted-foreground text-right">
                        {entry.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
