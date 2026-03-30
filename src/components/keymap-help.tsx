"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useCallback, useEffect, useState } from "react";
import { useKeymaps } from "@/contexts/keymaps";
import { useStatusBar } from "@/contexts/status-bar";
import { commandRegistry } from "@/core/commands";
import {
  DEFAULT_KEYMAPS,
  formatKey,
  HELP_SECTIONS,
  type HelpRow,
  isBrowserReserved,
  isModifierOnly,
  type KeymapDef,
  SECTION_LABELS,
  sectionsForPath,
} from "@/lib/keymap-defs";

export function KeymapHelp({
  open,
  onClose,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
}) {
  const keymaps = useKeymaps();
  const statusBar = useStatusBar();
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const visibleSections = sectionsForPath(pathname);
  const filteredSections = HELP_SECTIONS.filter((s) =>
    visibleSections.includes(s.section),
  );

  useEffect(() => {
    if (!open) {
      setCapturingId(null);
      setCaptureError(null);
    }
  }, [open]);

  const handleCapture = useCallback(
    async (defId: string, triggerKey: string) => {
      const def = DEFAULT_KEYMAPS.find((d) => d.id === defId);
      if (!def) return;
      const sectionDefs = DEFAULT_KEYMAPS.filter(
        (d) =>
          d.section === def.section &&
          d.id !== def.id &&
          d.configurable !== false,
      );
      const duplicate = sectionDefs.find((d) => {
        const resolved = keymaps.getResolvedKeymap(d.id);
        return (
          resolved.triggerKey === triggerKey &&
          JSON.stringify(resolved.modifiers ?? []) ===
            JSON.stringify(def.modifiers ?? [])
        );
      });
      if (duplicate) {
        setCaptureError(`already bound to "${duplicate.label}"`);
        return;
      }
      await keymaps.setOverride(defId, triggerKey);
      setCapturingId(null);
      setCaptureError(null);
      statusBar.message("keymap updated");
    },
    [keymaps, statusBar],
  );

  const handleCancelCapture = useCallback(() => {
    setCapturingId(null);
    setCaptureError(null);
  }, []);

  const handleReset = useCallback(
    async (defId: string) => {
      await keymaps.resetOverride(defId);
      statusBar.message("keymap reset");
    },
    [keymaps, statusBar],
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup
          className="fixed inset-8 z-50 mx-auto max-w-2xl flex flex-col border border-border bg-card duration-100 outline-none overflow-auto data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          onKeyDown={(e) => {
            if (capturingId) return;
            if (e.key === "q") {
              e.preventDefault();
              onClose();
            }
          }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
            <span className="text-sm font-medium">Keyboard Shortcuts</span>
            <kbd className="text-[10px] text-muted-foreground">q to close</kbd>
          </div>
          <div className="grid grid-cols-2 gap-6 p-6 overflow-auto">
            {filteredSections.map((section) => (
              <div key={section.section}>
                <h3 className="text-xs font-medium text-muted-foreground mb-3">
                  {SECTION_LABELS[section.section]}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {section.rows.map((entry) => (
                    <HelpKeyRow
                      key={entry.keyDisplay}
                      entry={entry}
                      capturingId={capturingId}
                      captureError={captureError}
                      onStartCapture={(id) => {
                        setCapturingId(id);
                        setCaptureError(null);
                      }}
                      onCapture={handleCapture}
                      onCancelCapture={handleCancelCapture}
                      onReset={handleReset}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-3">
                Commands
              </h3>
              <div className="flex flex-col gap-1.5">
                {commandRegistry.map((cmd) => {
                  const aliases =
                    cmd.aliases.length > 0
                      ? ` (${cmd.aliases.map((a: string) => `:${a}`).join(", ")})`
                      : "";
                  return (
                    <div
                      key={cmd.name}
                      className="flex items-center justify-between gap-4"
                    >
                      <kbd className="text-xs text-foreground shrink-0 min-w-16">
                        :{cmd.name}
                        {aliases}
                      </kbd>
                      <span className="text-xs text-muted-foreground text-right">
                        {cmd.description}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function HelpKeyRow({
  entry,
  capturingId,
  captureError,
  onStartCapture,
  onCapture,
  onCancelCapture,
  onReset,
}: {
  entry: HelpRow;
  capturingId: string | null;
  captureError: string | null;
  onStartCapture: (id: string) => void;
  onCapture: (defId: string, triggerKey: string) => Promise<void>;
  onCancelCapture: () => void;
  onReset: (defId: string) => Promise<void>;
}) {
  const keymaps = useKeymaps();

  const isSingleConfigurable =
    entry.ids.length === 1 &&
    (() => {
      const def = DEFAULT_KEYMAPS.find((d) => d.id === entry.ids[0]);
      return def && def.configurable !== false;
    })();

  const singleId = isSingleConfigurable ? entry.ids[0] : null;
  const isCapturing = singleId !== null && capturingId === singleId;
  const isOverridden = singleId !== null && singleId in keymaps.overrides;

  const captureId = singleId ?? "";

  useEffect(() => {
    if (!isCapturing || !captureId) return;
    function handleKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        onCancelCapture();
        return;
      }
      if (isModifierOnly(e.key)) return;
      if (isBrowserReserved(e)) return;
      onCapture(captureId, e.key);
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isCapturing, captureId, onCapture, onCancelCapture]);

  const displayKey = resolveDisplayKey(entry, keymaps);

  if (!isSingleConfigurable) {
    return (
      <div className="flex items-center justify-between gap-4">
        <kbd className="text-xs text-foreground shrink-0 min-w-16">
          {displayKey}
        </kbd>
        <span className="text-xs text-muted-foreground text-right">
          {entry.label}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      {isCapturing ? (
        <span className="shrink-0 min-w-16 flex items-center gap-1">
          {captureError ? (
            <span className="text-destructive text-xs">{captureError}</span>
          ) : (
            <span className="text-muted-foreground text-xs animate-pulse">
              press key...
            </span>
          )}
        </span>
      ) : (
        <span className="shrink-0 min-w-16 flex items-center gap-1">
          <button
            type="button"
            className="cursor-pointer"
            onClick={() => onStartCapture(captureId)}
          >
            <kbd
              className={`font-mono text-xs px-1.5 py-0.5 border border-border ${isOverridden ? "text-foreground" : "text-muted-foreground"}`}
            >
              {displayKey}
            </kbd>
          </button>
          {isOverridden && (
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => onReset(captureId)}
            >
              reset
            </button>
          )}
        </span>
      )}
      <span className="text-xs text-muted-foreground text-right">
        {entry.label}
      </span>
    </div>
  );
}

function resolveDisplayKey(
  entry: { ids: string[]; keyDisplay: string },
  keymaps: {
    getResolvedKeymap: (id: string) => KeymapDef;
  },
): string {
  if (entry.ids.length !== 1) return entry.keyDisplay;
  const id = entry.ids[0];
  const resolved = keymaps.getResolvedKeymap(id);
  if (resolved.configurable === false) return entry.keyDisplay;
  return formatKey(resolved);
}
