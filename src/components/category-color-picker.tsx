"use client";

import { useCallback, useState } from "react";
import { HexColorPicker } from "react-colorful";
import {
  removeCategoryColorAction,
  setCategoryColorAction,
} from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";

const PRESETS = [
  "#7aa2f7",
  "#98c379",
  "#e5c07b",
  "#ff6b6b",
  "#c678dd",
  "#56b6c2",
  "#e5a56b",
  "#f48771",
  "#b5e890",
  "#9db8f7",
  "#e298ff",
  "#7dd6e0",
];

export function CategoryColorPicker({
  category,
  currentColor,
  onClose,
}: {
  category: string;
  currentColor: string | null;
  onClose: () => void;
}) {
  const [color, setColor] = useState(currentColor ?? "#7aa2f7");

  const handleSave = useCallback(async () => {
    await setCategoryColorAction(category, color);
    onClose();
  }, [category, color, onClose]);

  const handleRemove = useCallback(async () => {
    await removeCategoryColorAction(category);
    onClose();
  }, [category, onClose]);

  return (
    <div className="flex flex-col gap-3 p-3 w-56">
      <p className="text-xs font-medium text-muted-foreground truncate">
        {category}
      </p>
      <HexColorPicker
        color={color}
        onChange={setColor}
        style={{ width: "100%" }}
      />
      <div className="grid grid-cols-6 gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className={`size-6 rounded-full border transition-transform hover:scale-110 ${
              color === preset
                ? "ring-2 ring-ring ring-offset-1 ring-offset-background"
                : "border-border/60"
            }`}
            style={{ backgroundColor: preset }}
            onClick={() => setColor(preset)}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div
          className="size-5 rounded-full border border-border/60 shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs font-mono text-muted-foreground flex-1">
          {color}
        </span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} className="flex-1">
          Save
        </Button>
        {currentColor && (
          <Button size="sm" variant="ghost" onClick={handleRemove}>
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
