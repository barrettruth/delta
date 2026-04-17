"use client";

import { useSearchParams } from "next/navigation";
import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useKeymaps } from "@/contexts/keymaps";
import { useStatusBar } from "@/contexts/status-bar";
import { type CommandDefinition, commandRegistry } from "@/core/commands";
import {
  DEFAULT_KEYMAPS,
  formatKey,
  HELP_SECTIONS,
  type HelpSection,
  isBrowserReserved,
  isModifierOnly,
  type KeymapDef,
  SECTION_LABELS,
} from "@/lib/keymap-defs";
import { SettingsPage, SettingsSection } from "./settings-primitives";

const CONFIGURABLE_KEYMAPS = DEFAULT_KEYMAPS.filter(
  (def) => def.configurable !== false,
);
const CONFIGURABLE_KEYMAP_IDS = CONFIGURABLE_KEYMAPS.map((def) => def.id);
const CONFIGURABLE_KEYMAP_BY_ID = new Map(
  CONFIGURABLE_KEYMAPS.map((def) => [def.id, def]),
);

const HIGHLIGHT_CLASS = `
  relative -mx-4 px-4 py-2
  border-l-2 border-transparent
  transition-[background-color,border-color] duration-1000 ease-out
  data-[highlighted=true]:bg-accent/60
  data-[highlighted=true]:border-foreground/60
  data-[highlighted=true]:duration-0
`;
const GRID_CLASS = "grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2 p-2";
const ROW_CLASS = "flex items-center justify-between gap-4 py-0.5 px-2";

type KeymapsApi = ReturnType<typeof useKeymaps>;

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
  const hasOverrides = CONFIGURABLE_KEYMAP_IDS.some(
    (id) => id in keymaps.overrides,
  );

  useEffect(() => {
    if (!focusKey) return;
    const target = sectionRefs.current[focusKey];
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedSection(focusKey);

    const timeout = setTimeout(() => setHighlightedSection(null), 1800);
    return () => clearTimeout(timeout);
  }, [focusKey]);

  const handleStartCapture = useCallback((defId: string) => {
    setCapturingId(defId);
    setCaptureError(null);
  }, []);

  const handleCancelCapture = useCallback(() => {
    setCapturingId(null);
    setCaptureError(null);
  }, []);

  const handleCapture = useCallback(
    async (defId: string, triggerKey: string) => {
      const def = CONFIGURABLE_KEYMAP_BY_ID.get(defId);
      if (!def) return;

      const duplicate = findDuplicateKeymap(def, triggerKey, keymaps);
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
    await keymaps.resetSection(CONFIGURABLE_KEYMAP_IDS);
    statusBar.message("all keymaps reset to defaults");
  }, [keymaps, statusBar]);

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
        <HighlightedSection
          key={section.section}
          sectionKey={section.section}
          highlighted={highlightedSection === section.section}
          sectionRefs={sectionRefs}
        >
          <SettingsSection
            title={SECTION_LABELS[section.section]}
            dividers={false}
          >
            <KeymapRows
              section={section}
              keymaps={keymaps}
              capturingId={capturingId}
              captureError={captureError}
              onStartCapture={handleStartCapture}
              onCapture={handleCapture}
              onCancelCapture={handleCancelCapture}
              onReset={handleReset}
            />
          </SettingsSection>
        </HighlightedSection>
      ))}

      <HighlightedSection
        sectionKey="commands"
        highlighted={highlightedSection === "commands"}
        sectionRefs={sectionRefs}
      >
        <SettingsSection title="Commands" dividers={false}>
          <CommandRows />
        </SettingsSection>
      </HighlightedSection>
    </SettingsPage>
  );
}

function HighlightedSection({
  sectionKey,
  highlighted,
  sectionRefs,
  children,
}: {
  sectionKey: string;
  highlighted: boolean;
  sectionRefs: MutableRefObject<Record<string, HTMLElement | null>>;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={(el) => {
        sectionRefs.current[sectionKey] = el;
      }}
      data-highlighted={highlighted ? "true" : undefined}
      className={HIGHLIGHT_CLASS}
    >
      {children}
    </div>
  );
}

function KeymapRows({
  section,
  keymaps,
  capturingId,
  captureError,
  onStartCapture,
  onCapture,
  onCancelCapture,
  onReset,
}: {
  section: HelpSection;
  keymaps: KeymapsApi;
  capturingId: string | null;
  captureError: string | null;
  onStartCapture: (defId: string) => void;
  onCapture: (defId: string, triggerKey: string) => Promise<void>;
  onCancelCapture: () => void;
  onReset: (defId: string) => Promise<void>;
}) {
  return (
    <div className={GRID_CLASS}>
      {section.rows.map((entry) => {
        const defId = getConfigurableEntryId(entry.ids);
        const displayKey = resolveDisplayKey(entry, keymaps);

        if (!defId) {
          return (
            <StaticHelpRow
              key={entry.keyDisplay}
              displayKey={displayKey}
              label={entry.label}
            />
          );
        }

        const isCapturing = capturingId === defId;
        return (
          <KeyRow
            key={entry.keyDisplay}
            defId={defId}
            displayKey={displayKey}
            label={entry.label}
            isCapturing={isCapturing}
            isOverridden={defId in keymaps.overrides}
            captureError={isCapturing ? captureError : null}
            onStartCapture={() => onStartCapture(defId)}
            onCapture={onCapture}
            onCancelCapture={onCancelCapture}
            onReset={onReset}
          />
        );
      })}
    </div>
  );
}

function CommandRows() {
  return (
    <div className={GRID_CLASS}>
      {commandRegistry.map((command) => (
        <StaticHelpRow
          key={command.name}
          displayKey={formatCommandKey(command)}
          label={command.description}
          strong
        />
      ))}
    </div>
  );
}

function StaticHelpRow({
  displayKey,
  label,
  strong = false,
}: {
  displayKey: string;
  label: string;
  strong?: boolean;
}) {
  return (
    <div className={ROW_CLASS}>
      <kbd
        className={`text-xs shrink-0 min-w-16 ${
          strong ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {displayKey}
      </kbd>
      <span className="text-xs text-muted-foreground text-right">{label}</span>
    </div>
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
    <div className={ROW_CLASS}>
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
              className={`font-mono text-xs px-1.5 py-0.5 border border-border ${
                isOverridden ? "text-foreground" : "text-muted-foreground"
              }`}
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

function getConfigurableEntryId(ids: string[]): string | null {
  if (ids.length !== 1) return null;
  return CONFIGURABLE_KEYMAP_BY_ID.has(ids[0]) ? ids[0] : null;
}

function findDuplicateKeymap(
  def: KeymapDef,
  triggerKey: string,
  keymaps: KeymapsApi,
): KeymapDef | undefined {
  return CONFIGURABLE_KEYMAPS.find((candidate) => {
    if (candidate.section !== def.section || candidate.id === def.id) {
      return false;
    }

    const resolved = keymaps.getResolvedKeymap(candidate.id);
    return (
      resolved.triggerKey === triggerKey &&
      JSON.stringify(resolved.modifiers ?? []) ===
        JSON.stringify(def.modifiers ?? [])
    );
  });
}

function formatCommandKey(command: CommandDefinition): string {
  const args =
    command.expectedArgs && command.expectedArgs.length > 0
      ? ` [${command.expectedArgs.join("|")}]`
      : "";
  const aliases =
    command.aliases.length > 0
      ? ` (${command.aliases.map((alias) => `:${alias}`).join(", ")})`
      : "";
  return `:${command.name}${args}${aliases}`;
}

function resolveDisplayKey(
  entry: { ids: string[]; keyDisplay: string },
  keymaps: KeymapsApi,
): string {
  const defId = getConfigurableEntryId(entry.ids);
  return defId ? formatKey(keymaps.getResolvedKeymap(defId)) : entry.keyDisplay;
}
