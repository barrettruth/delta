"use client";

import { useStatusBar } from "@/contexts/status-bar";

export function StatusBar() {
  const { state } = useStatusBar();

  return (
    <div className="h-7 shrink-0 border-t border-border bg-background flex items-center justify-between px-2 md:px-4 font-mono text-[13px] text-muted-foreground overflow-hidden">
      <div className="truncate">
        {state.primary !== "" ? (
          state.primaryType === "error" ? (
            <span className="text-destructive">{state.primary}</span>
          ) : state.primaryType === "warning" ? (
            <span className="text-status-wip">{state.primary}</span>
          ) : state.primaryType === "undo" ? (
            <span>
              <span className="text-line-nr">u</span>
              {"  "}
              {state.primary}
            </span>
          ) : (
            <span>{state.primary}</span>
          )
        ) : state.idleLeft !== "" ? (
          <span className="text-line-nr">{state.idleLeft}</span>
        ) : null}
      </div>
      <div className="flex items-center gap-4 text-line-nr">
        {state.operation !== "" ? (
          <span>{state.operation}</span>
        ) : state.idleRight !== "" ? (
          <span>{state.idleRight}</span>
        ) : null}
      </div>
    </div>
  );
}
