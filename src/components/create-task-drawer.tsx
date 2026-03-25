"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createTaskAction } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRIORITIES = [
  { value: "0", indicator: "\u2014" },
  { value: "1", indicator: "!" },
  { value: "2", indicator: "!!" },
  { value: "3", indicator: "!!!" },
];

export function CreateTaskDrawer({
  open,
  onOpenChange,
  defaultDue,
  categories,
  defaultCategory = "Todo",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDue?: string;
  categories?: string[];
  defaultCategory?: string;
}) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [priority, setPriority] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [showCategories, setShowCategories] = useState(false);
  const descRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (defaultDue) setDueDate(defaultDue.slice(0, 10));
      requestAnimationFrame(() => descRef.current?.focus());
    }
  }, [open, defaultDue]);

  const filteredCategories = (categories ?? []).filter(
    (c) => c.toLowerCase().includes(category.toLowerCase()) && c !== category,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }

    const result = await createTaskAction({
      description: description.trim(),
      category,
      priority: Number(priority),
      due: dueDate
        ? new Date(`${dueDate}T${dueTime || "12:00"}:00`).toISOString()
        : undefined,
    });

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    setDescription("");
    setCategory(defaultCategory);
    setPriority("0");
    setDueDate("");
    setDueTime("");
    onOpenChange(false);
  }

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(o) => !o && onOpenChange(false)}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card duration-150 outline-none data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom">
          <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-3xl px-6 py-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">New Task</span>
              <kbd className="text-[10px] text-muted-foreground">
                Escape to close
              </kbd>
            </div>
            <Input
              ref={descRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to be done?"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1.5 relative">
                <Label
                  htmlFor="drawer-category"
                  className="text-xs text-muted-foreground"
                >
                  Category
                </Label>
                <Input
                  id="drawer-category"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setShowCategories(true);
                  }}
                  onFocus={() => setShowCategories(true)}
                  onBlur={() => setTimeout(() => setShowCategories(false), 150)}
                />
                {showCategories && filteredCategories.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 border border-border bg-popover py-1">
                    {filteredCategories.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors"
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          setCategory(c);
                          setShowCategories(false);
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Priority
                </Label>
                <div className="flex gap-1">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      className={`flex-1 h-8 text-xs font-medium transition-colors border ${
                        priority === p.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent text-muted-foreground border-border hover:bg-accent"
                      }`}
                      onClick={() => setPriority(p.value)}
                    >
                      {p.indicator}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="drawer-due"
                  className="text-xs text-muted-foreground"
                >
                  Due Date
                </Label>
                <Input
                  id="drawer-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="drawer-time"
                  className="text-xs text-muted-foreground"
                >
                  Time
                </Label>
                <Input
                  id="drawer-time"
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={!description.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Create
            </Button>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
