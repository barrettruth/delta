"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { useCommandBar } from "@/contexts/command-bar";
import { useStatusBar } from "@/contexts/status-bar";
import { useTaskPanel } from "@/contexts/task-panel";
import { useUndo } from "@/contexts/undo";
import {
  type CommandContext,
  commandRegistry,
  executeCommand,
  getCompletions,
  longestCommonPrefix,
} from "@/core/commands";

export function StatusBar() {
  const { state } = useStatusBar();
  const statusBar = useStatusBar();
  const commandBar = useCommandBar();
  const router = useRouter();
  const { toggleSidebar } = useSidebar();
  const panel = useTaskPanel();
  const { undo: performUndo } = useUndo();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (commandBar.active) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [commandBar.active]);

  const buildContext = useCallback((): CommandContext => {
    return {
      router: {
        push: (url: string) => router.push(url),
        refresh: () => router.refresh(),
      },
      logout: (force?: boolean) => {
        void force;
        fetch("/api/auth/logout", { method: "POST" }).then(() => {
          router.push("/login");
        });
      },
      toggleSidebar,
      openHelp: () => window.dispatchEvent(new Event("open-keymap-help")),
      undo: () => performUndo(),
      taskPanel: {
        isOpen: panel.isOpen,
        mode: panel.mode,
        taskId: panel.taskId,
        open: panel.open,
        create: panel.create,
        close: panel.close,
      },
      saveTask: () => {
        window.dispatchEvent(new Event("command-save-task"));
      },
      discardTask: () => {
        window.dispatchEvent(new Event("command-discard-task"));
      },
      importIcal: () => fileRef.current?.click(),
      exportIcal: () => {
        window.location.href = "/api/export/ical";
      },
      syncGoogle: () => {
        statusBar.message("sync not configured");
      },
      statusBar: {
        message: statusBar.message,
        error: statusBar.error,
      },
    };
  }, [router, toggleSidebar, performUndo, panel, statusBar]);

  const handleExecute = useCallback(() => {
    const raw = commandBar.input.trim();
    if (!raw) {
      commandBar.deactivate();
      return;
    }
    commandBar.pushHistory(raw);
    commandBar.deactivate();
    const err = executeCommand(raw, commandRegistry, buildContext());
    if (err) {
      statusBar.error(err);
    }
  }, [commandBar, buildContext, statusBar]);

  const handleTab = useCallback(() => {
    const input = commandBar.input;
    if (!input) return;

    const matches = getCompletions(input, commandRegistry);
    if (matches.length === 0) return;
    if (matches.length === 1) {
      commandBar.setInput(matches[0]);
    } else {
      const common = longestCommonPrefix(matches);
      if (common.length > input.length) {
        commandBar.setInput(common);
      }
    }
  }, [commandBar]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleExecute();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        commandBar.deactivate();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        commandBar.navigateHistory("up");
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        commandBar.navigateHistory("down");
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        handleTab();
        return;
      }
      if (e.ctrlKey && e.key === "w") {
        e.preventDefault();
        const val = commandBar.input;
        const trimmed = val.trimEnd();
        const lastSpace = trimmed.lastIndexOf(" ");
        commandBar.setInput(
          lastSpace === -1 ? "" : trimmed.slice(0, lastSpace + 1),
        );
        return;
      }
      if (e.ctrlKey && e.key === "u") {
        e.preventDefault();
        commandBar.setInput("");
        return;
      }
    },
    [commandBar, handleExecute, handleTab],
  );

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/import/ical", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        statusBar.error(data.error ?? "import failed");
        return;
      }
      statusBar.message(
        `imported ${data.created} events, skipped ${data.skipped} duplicates`,
      );
    } catch (err) {
      statusBar.error(err instanceof Error ? err.message : "import failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  if (commandBar.active) {
    return (
      <div className="h-7 shrink-0 border-t border-border bg-background flex items-center px-2 md:px-4 font-mono text-[13px] text-foreground overflow-hidden">
        <span className="shrink-0">:</span>
        <input
          ref={inputRef}
          value={commandBar.input}
          onChange={(e) => commandBar.setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commandBar.deactivate()}
          className="flex-1 bg-transparent border-none outline-none ml-0 text-[13px] font-mono"
          spellCheck={false}
          autoComplete="off"
        />
        <input
          ref={fileRef}
          type="file"
          accept=".ics"
          className="hidden"
          onChange={() => handleImport()}
        />
      </div>
    );
  }

  return (
    <div className="h-7 shrink-0 border-t border-border bg-background flex items-center justify-between px-2 md:px-4 font-mono text-[13px] text-muted-foreground overflow-hidden">
      <div className="truncate">
        {state.primary !== "" ? (
          state.primaryType === "error" ? (
            <span className="text-destructive">{state.primary}</span>
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
        <span>{timezone}</span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".ics"
        className="hidden"
        onChange={() => handleImport()}
      />
    </div>
  );
}
