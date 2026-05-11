"use client";

import { Trash, X } from "@phosphor-icons/react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { ResizeHandle } from "@/components/resize-handle";
import type { Task } from "@/core/types";

type TaskPanelMode = "edit" | "create";

export function TaskPanelFrame({
  children,
  isMobile,
  onKeyDown,
  onResize,
  variant,
  width,
}: {
  children: ReactNode;
  isMobile: boolean;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onResize: (width: number) => void;
  variant: "sidebar" | "popover";
  width: number;
}) {
  const isSidebar = variant === "sidebar";

  return (
    <>
      {isSidebar && !isMobile && <ResizeHandle onResize={onResize} />}
      <div
        role="region"
        style={isSidebar && !isMobile ? { width: `${width}%` } : undefined}
        className={
          isSidebar
            ? "flex flex-col h-full border-l border-border bg-card shrink-0 overflow-hidden w-full"
            : "flex flex-col h-full w-full bg-card overflow-hidden"
        }
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </>
  );
}

export function TaskPanelHeader({
  description,
  isMobile,
  mode,
  onClose,
  onDelete,
  onDescriptionChange,
  task,
  titleRef,
}: {
  description: string;
  isMobile: boolean;
  mode: TaskPanelMode;
  onClose: () => void;
  onDelete: () => void;
  onDescriptionChange: (description: string) => void;
  task: Task | null;
  titleRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="px-4 pt-3 pb-2">
      {isMobile && (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground mb-2 min-h-[44px] flex items-center"
          onClick={onClose}
        >
          &larr; back
        </button>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={titleRef}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          className="flex-1 text-base font-medium bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
          placeholder={mode === "create" ? "New task..." : "Task description"}
        />
        {mode === "edit" && task && (
          <button
            type="button"
            aria-label="delete task"
            className="text-muted-foreground hover:text-destructive shrink-0 p-1 transition-colors cursor-pointer"
            onClick={onDelete}
          >
            <Trash size={14} />
          </button>
        )}
        <button
          type="button"
          aria-label="close task panel"
          className="text-muted-foreground hover:text-foreground shrink-0 p-1 border border-border hover:border-foreground/30 transition-colors cursor-pointer"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
