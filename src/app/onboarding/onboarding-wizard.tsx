"use client";

import type { Icon } from "@phosphor-icons/react";
import { Calendar, Columns, List } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ConflictResolution } from "@/core/types";
import type { KeymapDef } from "@/lib/keymap-defs";
import {
  DEFAULT_KEYMAPS,
  formatKey,
  isBrowserReserved,
  isModifierOnly,
} from "@/lib/keymap-defs";
import { ANTHROPIC_MODELS, OPENAI_MODELS } from "@/lib/nlp-models";

type Step = 1 | 2 | 3;
type DefaultView = "queue" | "kanban" | "calendar";
type GeoProvider = "photon" | "mapbox" | "google_maps";
type OnboardingNlpProvider = "builtin" | "anthropic" | "openai";

const STORAGE_KEY = "delta:onboarding";

const VIEW_OPTIONS: {
  id: DefaultView;
  label: string;
  icon: Icon;
  blurb: string;
}[] = [
  {
    id: "queue",
    label: "queue",
    icon: List,
    blurb:
      "Ranked list sorted by urgency. Tasks scored by due date, age, and status. The default for getting things done.",
  },
  {
    id: "kanban",
    label: "kanban",
    icon: Columns,
    blurb:
      "Columns by status. Drag tasks between Waiting, In Progress, Blocked, and Done.",
  },
  {
    id: "calendar",
    label: "calendar",
    icon: Calendar,
    blurb:
      "Week and month views. Events on a timeline. Best if your workflow is time-driven.",
  },
];

const GEO_OPTIONS: {
  id: GeoProvider;
  label: string;
  blurb: string;
  needsKey: boolean;
}[] = [
  {
    id: "photon",
    label: "photon",
    blurb:
      "Open-source geocoding powered by OpenStreetMap. No API key required. Requests are not logged. Best for privacy.",
    needsKey: false,
  },
  {
    id: "mapbox",
    label: "mapbox",
    blurb:
      "Commercial geocoding with high accuracy. Requires a free API key from mapbox.com.",
    needsKey: true,
  },
  {
    id: "google_maps",
    label: "google maps",
    blurb:
      "Google's geocoding API. Requires an API key from Google Cloud Console.",
    needsKey: true,
  },
];

const NLP_OPTIONS: {
  id: OnboardingNlpProvider;
  label: string;
  blurb: string;
  needsKey: boolean;
}[] = [
  {
    id: "builtin",
    label: "built-in",
    blurb:
      "Rule-based parsing for dates and recurrence. No external API calls. Works offline.",
    needsKey: false,
  },
  {
    id: "anthropic",
    label: "anthropic",
    blurb:
      "Use Anthropic's Claude models for natural language parsing. Requires an API key from console.anthropic.com.",
    needsKey: true,
  },
  {
    id: "openai",
    label: "openai",
    blurb:
      "Use OpenAI's GPT models for natural language parsing. Requires an API key from platform.openai.com.",
    needsKey: true,
  },
];

const CONFLICT_OPTIONS: {
  id: ConflictResolution;
  label: string;
  blurb: string;
}[] = [
  {
    id: "lww",
    label: "last write wins",
    blurb:
      "Whichever side was modified most recently takes precedence. Both systems can edit events freely.",
  },
  {
    id: "google_wins",
    label: "google wins",
    blurb:
      "Google Calendar is the source of truth. Synced events cannot be edited in delta.",
  },
  {
    id: "delta_wins",
    label: "delta wins",
    blurb:
      "Delta is the source of truth. Changes in Google Calendar are overwritten on sync.",
  },
];

const CURATED_KEYS = [
  "global.queue",
  "global.kanban",
  "global.calendar",
  "global.settings",
  "global.undo",
  "global.create_task",
  "global.help",
  "queue.move_down",
  "queue.move_up",
  "queue.edit",
  "queue.complete",
  "queue.delete",
  "queue.search",
  "calendar.prev_period",
  "calendar.next_period",
  "calendar.today",
  "calendar.actions",
  "nav.jump_back",
  "nav.jump_forward",
];

export function OnboardingWizard({
  gcalConnected: initialGcalConnected,
  initialGeoProvider,
  initialNlpProvider,
  initialNlpModel,
}: {
  gcalConnected: boolean;
  initialGeoProvider: GeoProvider;
  initialNlpProvider: OnboardingNlpProvider;
  initialNlpModel: string;
}) {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [defaultView, setDefaultView] = useState<DefaultView>("queue");
  const [defaultCategory, setDefaultCategory] = useState("Todo");
  const [gcalConnected, setGcalConnected] = useState(initialGcalConnected);
  const [geoProvider, setGeoProvider] =
    useState<GeoProvider>(initialGeoProvider);
  const [geoApiKey, setGeoApiKey] = useState("");
  const [nlpProvider, setNlpProvider] =
    useState<OnboardingNlpProvider>(initialNlpProvider);
  const [nlpApiKey, setNlpApiKey] = useState("");
  const [nlpModel, setNlpModel] = useState(initialNlpModel);
  const [conflictResolution, setConflictResolution] =
    useState<ConflictResolution>("lww");
  const [keymapOverrides, setKeymapOverrides] = useState<
    Record<string, string>
  >({});
  const [focusIdx, setFocusIdx] = useState(0);
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [geoKeyTesting, setGeoKeyTesting] = useState(false);
  const [geoKeyStatus, setGeoKeyStatus] = useState<"valid" | "invalid" | null>(
    null,
  );
  const [geoKeyError, setGeoKeyError] = useState("");
  const [nlpKeyTesting, setNlpKeyTesting] = useState(false);
  const [nlpKeyStatus, setNlpKeyStatus] = useState<"valid" | "invalid" | null>(
    null,
  );
  const [nlpKeyError, setNlpKeyError] = useState("");
  const countBuf = useRef("");

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const state = JSON.parse(saved);
        if (state.step) setStep(state.step);
        if (state.defaultView) setDefaultView(state.defaultView);
        if (state.defaultCategory) setDefaultCategory(state.defaultCategory);
        if (state.geoProvider) setGeoProvider(state.geoProvider);
        if (state.geoApiKey) setGeoApiKey(state.geoApiKey);
        if (state.nlpProvider) setNlpProvider(state.nlpProvider);
        if (state.nlpApiKey) setNlpApiKey(state.nlpApiKey);
        if (state.nlpModel) setNlpModel(state.nlpModel);
        setGcalConnected(initialGcalConnected);
      } catch {}
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [initialGcalConnected]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset focus on step change
  useEffect(() => {
    setFocusIdx(0);
    countBuf.current = "";
  }, [step]);

  const handleGcalConnect = useCallback(() => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        step: 2,
        defaultView,
        defaultCategory,
        geoProvider,
        geoApiKey,
        nlpProvider,
        nlpApiKey,
        nlpModel,
      }),
    );
    window.location.href = "/api/auth/google?scope=calendar.events";
  }, [
    defaultView,
    defaultCategory,
    geoProvider,
    geoApiKey,
    nlpProvider,
    nlpApiKey,
    nlpModel,
  ]);

  async function testApiKey(
    provider: string,
    apiKey: string,
    model?: string,
  ): Promise<{ valid: boolean; error?: string }> {
    const res = await fetch("/api/settings/integrations/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey, model }),
    });
    return res.json();
  }

  async function handleTestGeoKey() {
    if (!geoApiKey.trim()) return;
    setGeoKeyTesting(true);
    setGeoKeyStatus(null);
    setGeoKeyError("");
    try {
      const result = await testApiKey(geoProvider, geoApiKey.trim());
      setGeoKeyStatus(result.valid ? "valid" : "invalid");
      if (!result.valid) setGeoKeyError(result.error ?? "invalid api key");
    } catch {
      setGeoKeyStatus("invalid");
      setGeoKeyError("connection failed");
    } finally {
      setGeoKeyTesting(false);
    }
  }

  async function handleTestNlpKey() {
    if (!nlpApiKey.trim()) return;
    setNlpKeyTesting(true);
    setNlpKeyStatus(null);
    setNlpKeyError("");
    try {
      const result = await testApiKey(
        nlpProvider,
        nlpApiKey.trim(),
        nlpModel || undefined,
      );
      setNlpKeyStatus(result.valid ? "valid" : "invalid");
      if (!result.valid) setNlpKeyError(result.error ?? "invalid api key");
    } catch {
      setNlpKeyStatus("invalid");
      setNlpKeyError("connection failed");
    } finally {
      setNlpKeyTesting(false);
    }
  }

  async function handleFinish() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultView,
          defaultCategory,
          geoProvider,
          geoApiKey: geoApiKey || undefined,
          nlpProvider,
          nlpApiKey: nlpApiKey || undefined,
          nlpModel: nlpModel || undefined,
          conflictResolution: gcalConnected ? conflictResolution : undefined,
          keymapOverrides:
            Object.keys(keymapOverrides).length > 0
              ? keymapOverrides
              : undefined,
        }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const curatedDefs = CURATED_KEYS.map((id) =>
    DEFAULT_KEYMAPS.find((d) => d.id === id),
  ).filter(Boolean) as KeymapDef[];

  const step2ItemCount = (() => {
    let count = 1;
    count += GEO_OPTIONS.length;
    count += NLP_OPTIONS.length;
    if (gcalConnected) count += CONFLICT_OPTIONS.length;
    return count;
  })();

  const handleStep2Select = useCallback(
    (idx: number) => {
      if (idx === 0) {
        if (gcalConnected) return;
        handleGcalConnect();
        return;
      }
      let offset = 1;
      if (idx < offset + GEO_OPTIONS.length) {
        const geoIdx = idx - offset;
        const newGeo = GEO_OPTIONS[geoIdx];
        if (newGeo.id !== geoProvider) {
          setGeoProvider(newGeo.id);
          setGeoKeyStatus(null);
          setGeoKeyError("");
          if (!newGeo.needsKey) setGeoApiKey("");
        }
        return;
      }
      offset += GEO_OPTIONS.length;
      if (idx < offset + NLP_OPTIONS.length) {
        const nlpIdx = idx - offset;
        const opt = NLP_OPTIONS[nlpIdx];
        if (opt.id !== nlpProvider) {
          setNlpProvider(opt.id);
          setNlpKeyStatus(null);
          setNlpKeyError("");
          if (opt.needsKey) {
            const models =
              opt.id === "anthropic" ? ANTHROPIC_MODELS : OPENAI_MODELS;
            setNlpModel(models[0].id);
          } else {
            setNlpApiKey("");
            setNlpModel("");
          }
        }
        return;
      }
      offset += NLP_OPTIONS.length;
      if (gcalConnected && idx < offset + CONFLICT_OPTIONS.length) {
        setConflictResolution(CONFLICT_OPTIONS[idx - offset].id);
      }
    },
    [gcalConnected, handleGcalConnect, geoProvider, nlpProvider],
  );

  useEffect(() => {
    if (step === 3 && capturingId) {
      function handleCapture(e: KeyboardEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "Escape") {
          setCapturingId(null);
          return;
        }
        if (isModifierOnly(e.key)) return;
        if (isBrowserReserved(e)) return;
        setKeymapOverrides((prev) => ({
          ...prev,
          [capturingId as string]: e.key,
        }));
        setCapturingId(null);
      }
      window.addEventListener("keydown", handleCapture, true);
      return () => window.removeEventListener("keydown", handleCapture, true);
    }
  }, [step, capturingId]);

  useEffect(() => {
    if (capturingId) return;

    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      if (e.key >= "0" && e.key <= "9") {
        countBuf.current += e.key;
        e.preventDefault();
        return;
      }

      const count = Math.max(1, Number.parseInt(countBuf.current, 10) || 1);
      countBuf.current = "";

      if (e.key === "j") {
        e.preventDefault();
        const max =
          step === 1
            ? VIEW_OPTIONS.length - 1
            : step === 2
              ? step2ItemCount - 1
              : curatedDefs.length - 1;
        setFocusIdx((prev) => Math.min(prev + count, max));
      } else if (e.key === "k") {
        e.preventDefault();
        setFocusIdx((prev) => Math.max(prev - count, 0));
      } else if (e.key === "Enter" && step === 1) {
        e.preventDefault();
        if (focusIdx < VIEW_OPTIONS.length) {
          setDefaultView(VIEW_OPTIONS[focusIdx].id);
        }
      } else if (e.key === "Enter" && step === 2) {
        e.preventDefault();
        handleStep2Select(focusIdx);
      } else if (e.key === "Enter" && step === 3) {
        e.preventDefault();
        const def = curatedDefs[focusIdx];
        if (def?.configurable !== false) {
          setCapturingId(def.id);
        }
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    step,
    focusIdx,
    capturingId,
    step2ItemCount,
    curatedDefs,
    handleStep2Select,
  ]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center w-full max-w-md px-4">
        <span className="font-serif text-6xl text-foreground select-none mb-4">
          δ
        </span>

        <div className="flex gap-2 mb-6">
          {([1, 2, 3] as const).map((s) => (
            <div
              key={s}
              className={`h-px w-6 ${step === s ? "bg-foreground" : "bg-muted-foreground/30"}`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="flex flex-col w-full gap-4">
            <div className="flex flex-col border border-border">
              {VIEW_OPTIONS.map((opt, i) => {
                const Icon = opt.icon;
                const selected = defaultView === opt.id;
                const focused = focusIdx === i;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`flex items-center gap-3 w-full px-3 py-2 text-xs transition-colors ${
                      focused ? "bg-accent" : selected ? "bg-accent/50" : ""
                    }`}
                    onClick={() => {
                      setDefaultView(opt.id);
                      setFocusIdx(i);
                    }}
                    onMouseEnter={() => setFocusIdx(i)}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span
                      className={
                        selected ? "text-foreground" : "text-muted-foreground"
                      }
                    >
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-muted-foreground leading-relaxed h-8">
              {VIEW_OPTIONS[focusIdx]?.blurb}
            </div>

            <Input
              value={defaultCategory}
              onChange={(e) => setDefaultCategory(e.target.value)}
              placeholder="default category"
              className="h-8 text-xs"
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setStep(2)}
              >
                next
              </Button>
            </div>
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-foreground text-center"
              onClick={handleFinish}
            >
              skip all
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col w-full gap-3">
            <div className="flex flex-col border border-border">
              <button
                type="button"
                className={`flex items-center w-full px-3 py-2 text-xs transition-colors ${
                  focusIdx === 0 ? "bg-accent" : ""
                }`}
                onClick={() => {
                  setFocusIdx(0);
                  if (!gcalConnected) handleGcalConnect();
                }}
                onMouseEnter={() => setFocusIdx(0)}
              >
                <span
                  className={
                    gcalConnected
                      ? "text-status-done mr-1"
                      : "text-status-done mr-1"
                  }
                >
                  {gcalConnected ? "✓" : "+"}
                </span>
                <span
                  className={
                    gcalConnected ? "text-foreground" : "text-muted-foreground"
                  }
                >
                  {gcalConnected
                    ? "google calendar connected"
                    : "connect google calendar"}
                </span>
              </button>
            </div>

            <div className="flex flex-col border border-border">
              <div className="text-[10px] text-muted-foreground px-3 py-1">
                location API
              </div>
              {GEO_OPTIONS.map((opt, i) => {
                const globalIdx = 1 + i;
                const selected = geoProvider === opt.id;
                const focused = focusIdx === globalIdx;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`flex items-center w-full px-3 py-1.5 text-xs transition-colors ${
                      focused ? "bg-accent" : ""
                    }`}
                    onClick={() => {
                      setFocusIdx(globalIdx);
                      if (opt.id !== geoProvider) {
                        setGeoProvider(opt.id);
                        setGeoKeyStatus(null);
                        setGeoKeyError("");
                        if (!opt.needsKey) setGeoApiKey("");
                      }
                    }}
                    onMouseEnter={() => setFocusIdx(globalIdx)}
                  >
                    <span
                      className={
                        selected ? "text-foreground" : "text-muted-foreground"
                      }
                    >
                      {opt.label}
                    </span>
                  </button>
                );
              })}
              {(() => {
                const focusedGeo = GEO_OPTIONS[focusIdx - 1];
                const blurb = focusedGeo?.blurb;
                return focusIdx >= 1 &&
                  focusIdx < 1 + GEO_OPTIONS.length &&
                  blurb ? (
                  <div className="px-3 py-1.5 text-[10px] text-muted-foreground leading-relaxed">
                    {blurb}
                  </div>
                ) : null;
              })()}
              {GEO_OPTIONS.find((o) => o.id === geoProvider)?.needsKey && (
                <div className="px-3 pb-2 flex flex-col gap-1">
                  <div className="flex gap-2">
                    <Input
                      value={geoApiKey}
                      onChange={(e) => {
                        setGeoApiKey(e.target.value);
                        setGeoKeyStatus(null);
                        setGeoKeyError("");
                      }}
                      placeholder="api key"
                      className="h-7 text-xs flex-1"
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") handleTestGeoKey();
                      }}
                    />
                    <button
                      type="button"
                      disabled={geoKeyTesting || !geoApiKey.trim()}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 disabled:opacity-50"
                      onClick={handleTestGeoKey}
                    >
                      {geoKeyTesting
                        ? "..."
                        : geoKeyStatus === "valid"
                          ? "✓"
                          : "test"}
                    </button>
                  </div>
                  {geoKeyStatus === "invalid" && geoKeyError && (
                    <span className="text-[10px] text-destructive">
                      {geoKeyError}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col border border-border">
              <div className="text-[10px] text-muted-foreground px-3 py-1">
                NLP provider
              </div>
              {NLP_OPTIONS.map((opt, i) => {
                const globalIdx = 1 + GEO_OPTIONS.length + i;
                const selected = nlpProvider === opt.id;
                const focused = focusIdx === globalIdx;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`flex items-center w-full px-3 py-1.5 text-xs transition-colors ${
                      focused ? "bg-accent" : ""
                    }`}
                    onClick={() => {
                      setFocusIdx(globalIdx);
                      if (opt.id !== nlpProvider) {
                        setNlpProvider(opt.id);
                        setNlpKeyStatus(null);
                        setNlpKeyError("");
                        if (opt.needsKey) {
                          const m =
                            opt.id === "anthropic"
                              ? ANTHROPIC_MODELS
                              : OPENAI_MODELS;
                          setNlpModel(m[0].id);
                        } else {
                          setNlpApiKey("");
                          setNlpModel("");
                        }
                      }
                    }}
                    onMouseEnter={() => setFocusIdx(globalIdx)}
                  >
                    <span
                      className={
                        selected ? "text-foreground" : "text-muted-foreground"
                      }
                    >
                      {opt.label}
                    </span>
                  </button>
                );
              })}
              {(() => {
                const nlpStart = 1 + GEO_OPTIONS.length;
                const focusedNlp = NLP_OPTIONS[focusIdx - nlpStart];
                return focusIdx >= nlpStart &&
                  focusIdx < nlpStart + NLP_OPTIONS.length &&
                  focusedNlp ? (
                  <div className="px-3 py-1.5 text-[10px] text-muted-foreground leading-relaxed">
                    {focusedNlp.blurb}
                  </div>
                ) : null;
              })()}
              {(() => {
                const selectedOpt = NLP_OPTIONS.find(
                  (o) => o.id === nlpProvider,
                );
                if (!selectedOpt?.needsKey) return null;
                const models =
                  nlpProvider === "anthropic"
                    ? ANTHROPIC_MODELS
                    : OPENAI_MODELS;
                return (
                  <div className="px-3 pb-2 flex flex-col gap-2">
                    <div className="flex gap-1">
                      {models.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={`px-2 py-0.5 text-[10px] border border-border transition-colors ${
                            nlpModel === m.id
                              ? "text-foreground bg-accent"
                              : "text-muted-foreground"
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setNlpModel(m.id);
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={nlpApiKey}
                        onChange={(e) => {
                          setNlpApiKey(e.target.value);
                          setNlpKeyStatus(null);
                          setNlpKeyError("");
                        }}
                        placeholder="api key"
                        className="h-7 text-xs flex-1"
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") handleTestNlpKey();
                        }}
                      />
                      <button
                        type="button"
                        disabled={nlpKeyTesting || !nlpApiKey.trim()}
                        className="text-xs text-muted-foreground hover:text-foreground px-2 disabled:opacity-50"
                        onClick={handleTestNlpKey}
                      >
                        {nlpKeyTesting
                          ? "..."
                          : nlpKeyStatus === "valid"
                            ? "✓"
                            : "test"}
                      </button>
                    </div>
                    {nlpKeyStatus === "invalid" && nlpKeyError && (
                      <span className="text-[10px] text-destructive">
                        {nlpKeyError}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            {gcalConnected && (
              <div className="flex flex-col border border-border">
                <div className="text-[10px] text-muted-foreground px-3 py-1">
                  sync strategy
                </div>
                {CONFLICT_OPTIONS.map((opt, i) => {
                  const globalIdx =
                    1 + GEO_OPTIONS.length + NLP_OPTIONS.length + i;
                  const selected = conflictResolution === opt.id;
                  const focused = focusIdx === globalIdx;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`flex items-center w-full px-3 py-1.5 text-xs transition-colors ${
                        focused ? "bg-accent" : ""
                      }`}
                      onClick={() => {
                        setFocusIdx(globalIdx);
                        setConflictResolution(opt.id);
                      }}
                      onMouseEnter={() => setFocusIdx(globalIdx)}
                    >
                      <span
                        className={
                          selected ? "text-foreground" : "text-muted-foreground"
                        }
                      >
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
                {(() => {
                  const conflictStart =
                    1 + GEO_OPTIONS.length + NLP_OPTIONS.length;
                  const focusedConflict =
                    CONFLICT_OPTIONS[focusIdx - conflictStart];
                  return focusIdx >= conflictStart &&
                    focusIdx < conflictStart + CONFLICT_OPTIONS.length &&
                    focusedConflict ? (
                    <div className="px-3 py-1.5 text-[10px] text-muted-foreground leading-relaxed">
                      {focusedConflict.blurb}
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setStep(1)}
              >
                back
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={
                  (GEO_OPTIONS.find((o) => o.id === geoProvider)?.needsKey &&
                    geoKeyStatus !== "valid") ||
                  (NLP_OPTIONS.find((o) => o.id === nlpProvider)?.needsKey &&
                    nlpKeyStatus !== "valid")
                }
                onClick={() => setStep(3)}
              >
                next
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col w-full gap-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 border border-border p-3 max-h-[50vh] overflow-y-auto">
              {curatedDefs.map((def, i) => {
                const overrideKey = keymapOverrides[def.id];
                const displayKey = overrideKey ?? formatKey(def);
                const isConfigurable = def.configurable !== false;
                const isCapturing = capturingId === def.id;
                const focused = focusIdx === i;
                return (
                  <button
                    key={def.id}
                    type="button"
                    className={`flex items-center justify-between gap-2 px-1 py-0.5 text-xs transition-colors ${
                      focused ? "bg-accent" : ""
                    } ${isConfigurable ? "cursor-pointer" : "cursor-default"}`}
                    onClick={() => {
                      if (isConfigurable) setCapturingId(def.id);
                    }}
                    onMouseEnter={() => setFocusIdx(i)}
                  >
                    <span className="text-muted-foreground truncate">
                      {def.label}
                    </span>
                    <kbd
                      className={`shrink-0 text-[10px] px-1 py-0.5 border border-border ${
                        isCapturing
                          ? "animate-pulse text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {isCapturing ? "..." : displayKey}
                    </kbd>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setStep(2)}
              >
                back
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={submitting}
                onClick={handleFinish}
              >
                {submitting ? "..." : "finish"}
              </Button>
            </div>
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-foreground text-center"
              onClick={() => {
                setKeymapOverrides({});
                handleFinish();
              }}
            >
              use defaults
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
