"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useKeymaps } from "@/contexts/keymaps";
import { commandRegistry } from "@/core/commands";
import { HELP_SECTIONS, SECTION_LABELS } from "@/lib/keymap-defs";

export function KeymapHelp({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const keymaps = useKeymaps();

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
                  {section.rows.map((entry) => {
                    const displayKey =
                      entry.ids.length === 1
                        ? resolveDisplayKey(entry, keymaps)
                        : entry.keyDisplay;
                    return (
                      <div
                        key={entry.keyDisplay}
                        className="flex items-center justify-between gap-4"
                      >
                        <kbd className="text-xs text-foreground shrink-0 min-w-16">
                          {displayKey}
                        </kbd>
                        <span className="text-xs text-muted-foreground text-right">
                          {entry.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-3">
                Commands
              </h3>
              <div className="flex flex-col gap-1.5">
                {commandRegistry.map((cmd) => {
                  const aliases =
                    cmd.aliases.length > 0
                      ? ` (${cmd.aliases.map((a: string) => `:${a}`).join(", ")})`
                      : "";
                  return (
                    <div
                      key={cmd.name}
                      className="flex items-center justify-between gap-4"
                    >
                      <kbd className="text-xs text-foreground shrink-0 min-w-16">
                        :{cmd.name}
                        {aliases}
                      </kbd>
                      <span className="text-xs text-muted-foreground text-right">
                        {cmd.description}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function resolveDisplayKey(
  entry: { ids: string[]; keyDisplay: string },
  keymaps: {
    getResolvedKeymap: (id: string) => {
      triggerKey: string;
      configurable?: boolean;
    };
  },
): string {
  const id = entry.ids[0];
  const resolved = keymaps.getResolvedKeymap(id);
  if (resolved.configurable === false) return entry.keyDisplay;
  return resolved.triggerKey;
}
