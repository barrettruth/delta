"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useKeymaps } from "@/contexts/keymaps";
import { useStatusBar } from "@/contexts/status-bar";
import { commandRegistry } from "@/core/commands";
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
  const searchParams = useSearchParams();
  const focusKey = searchParams.get("focus");
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [highlightedSection, setHighlightedSection] = useState<string | null>(
    null,
  );
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!focusKey) return;
    const target = sectionRefs.current[focusKey];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedSection(focusKey);
    const timeout = setTimeout(() => setHighlightedSection(null), 1800);
    return () => clearTimeout(timeout);
  }, [focusKey]);

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
    <SettingsPage
      title="keymaps"
      description="Customize keyboard shortcuts across global navigation and focused task actions."
    >
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
        <div
          key={section.section}
          ref={(el) => {
            sectionRefs.current[section.section] = el;
          }}
          data-highlighted={
            highlightedSection === section.section ? "true" : undefined
          }
          className="
            relative -mx-4 px-4 py-2
            border-l-2 border-transparent
            transition-[background-color,border-color] duration-1000 ease-out
            data-[highlighted=true]:bg-accent/60
            data-[highlighted=true]:border-foreground/60
            data-[highlighted=true]:duration-0
          "
        >
          <SettingsSection
            title={SECTION_LABELS[section.section]}
            dividers={false}
          >
            <div className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2 p-2">
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
                const isCapturing =
                  singleId !== null && capturingId === singleId;
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
        </div>
      ))}

      <div
        ref={(el) => {
          sectionRefs.current.commands = el;
        }}
        data-highlighted={
          highlightedSection === "commands" ? "true" : undefined
        }
        className="
          relative -mx-4 px-4 py-2
          border-l-2 border-transparent
          transition-[background-color,border-color] duration-1000 ease-out
          data-[highlighted=true]:bg-accent/60
          data-[highlighted=true]:border-foreground/60
          data-[highlighted=true]:duration-0
        "
      >
        <SettingsSection title="Commands" dividers={false}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2 p-2">
            {commandRegistry.map((cmd) => {
              const aliases =
                cmd.aliases.length > 0
                  ? ` (${cmd.aliases.map((a) => `:${a}`).join(", ")})`
                  : "";
              const args =
                cmd.expectedArgs && cmd.expectedArgs.length > 0
                  ? ` [${cmd.expectedArgs.join("|")}]`
                  : "";
              return (
                <div
                  key={cmd.name}
                  className="flex items-center justify-between gap-4 py-0.5 px-2"
                >
                  <kbd className="text-xs text-foreground shrink-0 min-w-16">
                    :{cmd.name}
                    {args}
                    {aliases}
                  </kbd>
                  <span className="text-xs text-muted-foreground text-right">
                    {cmd.description}
                  </span>
                </div>
              );
            })}
          </div>
        </SettingsSection>
      </div>
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
