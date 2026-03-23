"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createTaskAction } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRIORITIES = [
  { value: "0", label: "None", indicator: "" },
  { value: "1", label: "Low", indicator: "!" },
  { value: "2", label: "Medium", indicator: "!!" },
  { value: "3", label: "High", indicator: "!!!" },
];

export function CreateTaskDialog({
  open,
  onOpenChange,
  defaultDue,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDue?: string;
  categories?: string[];
}) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Todo");
  const [priority, setPriority] = useState("0");
  const [due, setDue] = useState("");
  const [showCategories, setShowCategories] = useState(false);
  const categoryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && defaultDue) {
      setDue(defaultDue.slice(0, 10));
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
      due: due ? new Date(`${due}T12:00:00`).toISOString() : undefined,
    });

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    setDescription("");
    setCategory("Todo");
    setPriority("0");
    setDue("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 relative">
              <Label htmlFor="category">Category</Label>
              <Input
                ref={categoryRef}
                id="category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setShowCategories(true);
                }}
                onFocus={() => setShowCategories(true)}
                onBlur={() => setTimeout(() => setShowCategories(false), 150)}
              />
              {showCategories && filteredCategories.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-border bg-popover py-1 shadow-md">
                  {filteredCategories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
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
              <Label>Priority</Label>
              <div className="flex gap-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={`flex-1 h-9 rounded-md text-xs font-medium transition-colors border ${
                      priority === p.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-transparent text-muted-foreground border-border hover:bg-accent"
                    }`}
                    onClick={() => setPriority(p.value)}
                  >
                    {p.indicator || "—"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="due">Due Date</Label>
            <Input
              id="due"
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="text-sm"
            />
          </div>
          <Button type="submit" disabled={!description.trim()} className="mt-1">
            Create
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
