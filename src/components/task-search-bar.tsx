"use client";

import type { KeyboardEventHandler, Ref } from "react";
import { Input } from "@/components/ui/input";
import { formatTaskSearchCount } from "@/lib/task-search";
import { cn } from "@/lib/utils";

interface TaskSearchBarProps {
  className?: string;
  inputRef: Ref<HTMLInputElement>;
  onInputKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onQueryChange: (query: string) => void;
  query: string;
  resultCount: number;
  slashClassName?: string;
  totalCount: number;
}

export function TaskSearchBar({
  className,
  inputRef,
  onInputKeyDown,
  onQueryChange,
  query,
  resultCount,
  slashClassName,
  totalCount,
}: TaskSearchBarProps) {
  return (
    <div className={cn("flex items-center gap-2 py-1.5 border-b", className)}>
      <span className={cn("text-xs", slashClassName)}>/</span>
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onInputKeyDown}
        placeholder="filter tasks..."
        className="h-6 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
      />
      <span className="text-[10px] text-muted-foreground shrink-0">
        {formatTaskSearchCount(resultCount, totalCount)}
      </span>
    </div>
  );
}
