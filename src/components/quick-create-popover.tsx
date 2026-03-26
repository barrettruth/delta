"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { useEffect, useRef, useState } from "react";
import { createTaskAction } from "@/app/actions/tasks";
import { Input } from "@/components/ui/input";
import type { QuickCreatePreFill } from "@/lib/calendar-utils";
import { formatTime } from "@/lib/calendar-utils";

export function QuickCreatePopover({
  open,
  onOpenChange,
  anchor,
  preFill,
  onExpandToFull,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: Element | { getBoundingClientRect: () => DOMRect } | null;
  preFill?: QuickCreatePreFill;
  onExpandToFull?: (data: QuickCreatePreFill & { description: string }) => void;
}) {
  const [description, setDescription] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setDescription("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  async function handleSubmit() {
    const trimmed = description.trim();
    if (!trimmed) return;

    await createTaskAction({
      description: trimmed,
      ...preFill,
    });

    setDescription("");
    onOpenChange(false);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={anchor}
          side="bottom"
          sideOffset={4}
          align="start"
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup className="z-50 w-72 border border-border bg-popover text-popover-foreground p-3 outline-none flex flex-col gap-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <Input
              ref={inputRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Task description..."
              className="h-8 text-sm"
            />
            {preFill && (preFill.startAt || preFill.due) && (
              <div className="flex gap-2 text-[10px] text-muted-foreground">
                {preFill.startAt && (
                  <span>
                    {formatTime(new Date(preFill.startAt))}
                    {preFill.endAt && `\u2013${formatTime(new Date(preFill.endAt))}`}
                  </span>
                )}
                {preFill.allDay === 1 && <span>all day</span>}
              </div>
            )}
            <div className="flex items-center justify-between">
              {onExpandToFull && (
                <button
                  type="button"
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => {
                    onExpandToFull({
                      ...preFill,
                      description: description.trim(),
                    });
                    onOpenChange(false);
                  }}
                >
                  more options
                </button>
              )}
              <button
                type="button"
                className="text-xs px-3 py-1 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors ml-auto"
                onClick={handleSubmit}
                disabled={!description.trim()}
              >
                create
              </button>
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
