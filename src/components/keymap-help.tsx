"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

const sections = [
  {
    title: "Global",
    keys: [
      ["Q", "Queue view"],
      ["K", "Kanban view"],
      ["C", "Calendar view"],
      ["-", "Toggle sidebar"],
      ["q", "Logout"],
      ["g1-9", "Jump to category"],
      ["gc", "Create task"],
      ["g.", "Toggle done tasks"],
      ["g?", "This help"],
    ],
  },
  {
    title: "Queue / List",
    keys: [
      ["j / k", "Move down / up"],
      ["gg", "Jump to top"],
      ["G", "Jump to bottom"],
      ["Ctrl+d", "Half page down"],
      ["Ctrl+u", "Half page up"],
      ["/", "Search filter"],
      ["e", "Edit / create task"],
      ["x", "Complete task"],
      ["dd", "Delete task"],
      ["pp", "Set pending"],
      ["ww", "Set wip"],
      ["bb", "Set blocked"],
      ["v", "Toggle select"],
      ["V", "Visual select mode"],
      ["Escape", "Clear / close"],
    ],
  },
  {
    title: "Kanban",
    keys: [
      ["h / l", "Move between columns"],
      ["j / k", "Move within column"],
      ["H / L", "Move task left / right"],
      ["< / >", "Swap column left / right"],
      ["p / i / b / w", "Jump to column"],
      ["/", "Search filter"],
      ["e", "Edit / create task"],
      ["V", "Visual select mode"],
      ["x", "Complete task"],
      ["dd", "Delete task"],
      ["Escape", "Deactivate keyboard"],
    ],
  },
  {
    title: "Calendar",
    keys: [
      ["h / l", "Previous / next day"],
      ["j / k", "Previous / next week"],
      ["Enter", "View day in queue"],
      ["w", "Week view"],
      ["m", "Month view"],
      ["[[", "Previous period"],
      ["]]", "Next period"],
      ["t", "Jump to today"],
      ["Escape", "Clear selection"],
    ],
  },
  {
    title: "Task Detail",
    keys: [
      ["j / k", "Next / previous task"],
      ["Ctrl+S", "Save"],
      ["Escape", "Close"],
    ],
  },
];

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
        <DialogPrimitive.Popup className="fixed inset-8 z-50 mx-auto max-w-2xl flex flex-col border border-border bg-card duration-100 outline-none overflow-auto data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
            <span className="text-sm font-medium">Keyboard Shortcuts</span>
            <kbd className="text-[10px] text-muted-foreground">
              Escape to close
            </kbd>
          </div>
          <div className="grid grid-cols-2 gap-6 p-6 overflow-auto">
            {sections.map((section) => (
              <div key={section.title}>
                <h3 className="text-xs font-medium text-muted-foreground mb-3">
                  {section.title}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {section.keys.map(([key, desc]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-4"
                    >
                      <kbd className="text-xs text-foreground shrink-0 min-w-16">
                        {key}
                      </kbd>
                      <span className="text-xs text-muted-foreground text-right">
                        {desc}
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
