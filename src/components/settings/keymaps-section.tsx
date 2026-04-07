"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useKeymaps } from "@/contexts/keymaps";
import { useStatusBar } from "@/contexts/status-bar";
import {
  DEFAULT_KEYMAPS,
  formatKey,
  HELP_SECTIONS,
  isBrowserReserved,
  isModifierOnly,
  type KeymapDef,
  SECTION_LABELS,
} from "@/lib/keymap-defs";
import { SettingsPage, SettingsSection } from "./settings-primitives";

export function KeymapsSection() {
  const keymaps = useKeymaps();
  const statusBar = useStatusBar();
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const allConfigurableIds = useMemo(
    () =>
      DEFAULT_KEYMAPS.filter((d) => d.configurable !== false).map((d) => d.id),
    [],
  );
  const hasOverrides = allConfigurableIds.some((id) => id in keymaps.overrides);

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

  const handleReset = useCallback(
    async (defId: string) => {
      await keymaps.resetOverride(defId);
      statusBar.message("keymap reset");
    },
    [keymaps, statusBar],
  );

  const handleResetAll = useCallback(async () => {
    await keymaps.resetSection(allConfigurableIds);
    statusBar.message("all keymaps reset to defaults");
  }, [keymaps, allConfigurableIds, statusBar]);

  return (
    <SettingsPage className="max-w-4xl">
      {hasOverrides && (
        <div className="flex justify-end mb-4">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={handleResetAll}
          >
            reset all to defaults
          </button>
        </div>
      )}
      {HELP_SECTIONS.map((section) => (
        <SettingsSection
          key={section.section}
          title={SECTION_LABELS[section.section]}
        >
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
            {section.rows.map((entry) => {
              const isSingleConfigurable =
                entry.ids.length === 1 &&
                (() => {
                  const def = DEFAULT_KEYMAPS.find(
                    (d) => d.id === entry.ids[0],
                  );
                  return def && def.configurable !== false;
                })();
              const singleId = isSingleConfigurable
                ? (entry.ids[0] as string)
                : null;
              const isCapturing = singleId !== null && capturingId === singleId;
              const isOverridden =
                singleId !== null && singleId in keymaps.overrides;

              const displayKey = resolveDisplayKey(entry, keymaps);

              if (!isSingleConfigurable) {
                return (
                  <div
                    key={entry.keyDisplay}
                    className="flex items-center justify-between gap-4 py-0.5 px-2"
                  >
                    <kbd className="text-xs text-muted-foreground shrink-0 min-w-16">
                      {displayKey}
                    </kbd>
                    <span className="text-xs text-muted-foreground text-right">
                      {entry.label}
                    </span>
                  </div>
                );
              }

              return (
                <KeyRow
                  key={entry.keyDisplay}
                  defId={singleId as string}
                  displayKey={displayKey}
                  label={entry.label}
                  isCapturing={isCapturing}
                  isOverridden={isOverridden}
                  captureError={isCapturing ? captureError : null}
                  onStartCapture={() => {
                    setCapturingId(singleId);
                    setCaptureError(null);
                  }}
                  onCapture={handleCapture}
                  onCancelCapture={() => {
                    setCapturingId(null);
                    setCaptureError(null);
                  }}
                  onReset={handleReset}
                />
              );
            })}
          </div>
        </SettingsSection>
      ))}
    </SettingsPage>
  );
}

function KeyRow({
  defId,
  displayKey,
  label,
  isCapturing,
  isOverridden,
  captureError,
  onStartCapture,
  onCapture,
  onCancelCapture,
  onReset,
}: {
  defId: string;
  displayKey: string;
  label: string;
  isCapturing: boolean;
  isOverridden: boolean;
  captureError: string | null;
  onStartCapture: () => void;
  onCapture: (defId: string, triggerKey: string) => Promise<void>;
  onCancelCapture: () => void;
  onReset: (defId: string) => Promise<void>;
}) {
  useEffect(() => {
    if (!isCapturing) return;
    function handleKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        onCancelCapture();
        return;
      }
      if (isModifierOnly(e.key)) return;
      if (isBrowserReserved(e)) return;
      onCapture(defId, e.key);
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isCapturing, defId, onCapture, onCancelCapture]);

  return (
    <div className="flex items-center justify-between gap-4 py-0.5 px-2">
      {isCapturing ? (
        <span className="shrink-0 min-w-16">
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
            onClick={onStartCapture}
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
              onClick={() => onReset(defId)}
            >
              reset
            </button>
          )}
        </span>
      )}
      <span className="text-xs text-muted-foreground text-right">{label}</span>
    </div>
  );
}

function resolveDisplayKey(
  entry: { ids: string[]; keyDisplay: string },
  keymaps: { getResolvedKeymap: (id: string) => KeymapDef },
): string {
  if (entry.ids.length !== 1) return entry.keyDisplay;
  const id = entry.ids[0];
  const resolved = keymaps.getResolvedKeymap(id);
  if (resolved.configurable === false) return entry.keyDisplay;
  return formatKey(resolved);
}
