"use client";

import { useStatusBar } from "@/contexts/status-bar";

export function StatusBar() {
  const { state } = useStatusBar();

  return (
    <div className="h-7 shrink-0 border-t border-border bg-background flex items-center justify-between px-4 font-mono text-[13px] text-muted-foreground">
      <div>
        {state.primary !== "" &&
          (state.primaryType === "error" ? (
            <span className="text-destructive">{state.primary}</span>
          ) : state.primaryType === "undo" ? (
            <span>
              <span className="text-muted-foreground/40">u</span>
              {"  "}
              {state.primary}
            </span>
          ) : (
            <span>{state.primary}</span>
          ))}
      </div>
      <div className="text-muted-foreground/60">
        {state.operation !== "" && <span>{state.operation}</span>}
      </div>
    </div>
  );
}
