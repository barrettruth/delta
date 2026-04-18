"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { TaskPanel } from "@/components/task-panel";
import { useTaskPanel } from "@/contexts/task-panel";
import type { Task } from "@/core/types";

export type PopoverAnchor = HTMLElement | { rect: DOMRect } | null;

/**
 * Google-style event popover for the calendar view.
 *
 * Renders the full TaskPanel UX inside a compact popover anchored to the
 * clicked event (or pointer location for empty-slot creates). The panel
 * context still drives visibility (panel.isOpen) — this component just
 * picks the visual container.
 *
 * When `anchor` is a DOMRect-bearing object, we construct a Base UI
 * virtual element on the fly; when it's an HTMLElement, it's passed
 * through directly.
 */
export function CalendarEventPopover({
  tasks,
  anchor,
}: {
  tasks: Task[];
  anchor: PopoverAnchor;
}) {
  const panel = useTaskPanel();

  const resolvedAnchor = (() => {
    if (!anchor) return undefined;
    if (anchor instanceof HTMLElement) return anchor;
    return { getBoundingClientRect: () => anchor.rect };
  })();

  return (
    <PopoverPrimitive.Root
      open={panel.isOpen}
      onOpenChange={(open) => {
        if (!open) panel.close();
      }}
    >
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={resolvedAnchor}
          side="right"
          align="start"
          sideOffset={8}
          alignOffset={-8}
          collisionAvoidance={{ side: "flip", align: "shift" }}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup
            className="z-50 flex w-[min(480px,calc(100vw-2rem))] max-h-[min(640px,calc(100vh-5rem))] flex-col border border-border bg-popover text-popover-foreground shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)] outline-none overflow-hidden data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            aria-label="Event details"
          >
            <TaskPanel tasks={tasks} variant="popover" />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
