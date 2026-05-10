"use client";

import type { Icon } from "@phosphor-icons/react";
import { Calendar, Columns, List } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Step = 1 | 2;
type DefaultView = "queue" | "kanban" | "calendar";
type GeoProvider = "photon" | "mapbox" | "google_maps";
type IntegrationTab = "geocoding" | "nlp";
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

export function OnboardingWizard({
  initialGeoProvider,
  initialNlpProvider,
}: {
  initialGeoProvider: GeoProvider;
  initialNlpProvider: OnboardingNlpProvider;
}) {
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [defaultView, setDefaultView] = useState<DefaultView>("queue");
  const [defaultCategory, setDefaultCategory] = useState("Todo");
  const [geoProvider, setGeoProvider] =
    useState<GeoProvider>(initialGeoProvider);
  const [geoApiKey, setGeoApiKey] = useState("");
  const [nlpProvider, setNlpProvider] =
    useState<OnboardingNlpProvider>(initialNlpProvider);
  const [nlpApiKey, setNlpApiKey] = useState("");
  const [integrationTab, setIntegrationTab] =
    useState<IntegrationTab>("geocoding");
  const [focusIdx, setFocusIdx] = useState(0);
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
      } catch {}
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset focus on step change
  useEffect(() => {
    setFocusIdx(0);
    countBuf.current = "";
  }, [step]);

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
      const result = await testApiKey(nlpProvider, nlpApiKey.trim());
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

  const integrationItemCount =
    integrationTab === "geocoding" ? GEO_OPTIONS.length : NLP_OPTIONS.length;

  const selectIntegrationTab = useCallback((tab: IntegrationTab) => {
    setIntegrationTab(tab);
    setFocusIdx(0);
    countBuf.current = "";
  }, []);

  useEffect(() => {
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
          step === 1 ? VIEW_OPTIONS.length - 1 : integrationItemCount - 1;
        setFocusIdx((prev) => Math.min(prev + count, max));
      } else if (e.key === "k") {
        e.preventDefault();
        setFocusIdx((prev) => Math.max(prev - count, 0));
      } else if (step === 2 && (e.key === "h" || e.key === "ArrowLeft")) {
        e.preventDefault();
        selectIntegrationTab("geocoding");
      } else if (step === 2 && (e.key === "l" || e.key === "ArrowRight")) {
        e.preventDefault();
        selectIntegrationTab("nlp");
      } else if (e.key === "Enter" && step === 1) {
        e.preventDefault();
        if (focusIdx < VIEW_OPTIONS.length) {
          setDefaultView(VIEW_OPTIONS[focusIdx].id);
        }
      } else if (e.key === "Enter" && step === 2) {
        e.preventDefault();
        if (integrationTab === "geocoding") {
          const opt = GEO_OPTIONS[focusIdx];
          if (!opt) return;
          if (opt.id !== geoProvider) {
            setGeoProvider(opt.id);
            setGeoKeyStatus(null);
            setGeoKeyError("");
            if (!opt.needsKey) setGeoApiKey("");
          }
        } else {
          const opt = NLP_OPTIONS[focusIdx];
          if (opt && opt.id !== nlpProvider) {
            setNlpProvider(opt.id);
            setNlpKeyStatus(null);
            setNlpKeyError("");
            if (!opt.needsKey) {
              setNlpApiKey("");
            }
          }
        }
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    step,
    focusIdx,
    integrationTab,
    integrationItemCount,
    geoProvider,
    nlpProvider,
    selectIntegrationTab,
  ]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center w-full max-w-lg px-4">
        <span className="font-serif text-7xl text-foreground select-none mb-5">
          δ
        </span>

        <div className="flex gap-2 mb-6">
          {([1, 2] as const).map((s) => (
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
                    className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm transition-colors ${
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
            <div className="text-xs text-muted-foreground leading-relaxed min-h-10">
              {VIEW_OPTIONS[focusIdx]?.blurb}
            </div>

            <Input
              value={defaultCategory}
              onChange={(e) => setDefaultCategory(e.target.value)}
              placeholder="default category"
              className="h-9 text-sm"
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
            <div className="grid grid-cols-2 border border-border">
              {(
                [
                  ["geocoding", "geocoding"],
                  ["nlp", "NLP"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`px-3 py-2 text-sm transition-colors ${
                    integrationTab === id
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/40"
                  }`}
                  onClick={() => selectIntegrationTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {integrationTab === "geocoding" && (
              <div className="flex flex-col border border-border">
                <div className="text-xs text-muted-foreground px-3 py-1.5">
                  geocoding
                </div>
                {GEO_OPTIONS.map((opt, i) => {
                  const selected = geoProvider === opt.id;
                  const focused = focusIdx === i;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`flex items-center w-full px-3 py-2 text-sm transition-colors ${
                        focused ? "bg-accent" : ""
                      }`}
                      onClick={() => {
                        setFocusIdx(i);
                        if (opt.id !== geoProvider) {
                          setGeoProvider(opt.id);
                          setGeoKeyStatus(null);
                          setGeoKeyError("");
                          if (!opt.needsKey) setGeoApiKey("");
                        }
                      }}
                      onMouseEnter={() => setFocusIdx(i)}
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
                  const focusedGeo = GEO_OPTIONS[focusIdx];
                  const blurb = focusedGeo?.blurb;
                  return focusIdx < GEO_OPTIONS.length && blurb ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground leading-relaxed">
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
                        className="h-8 text-sm flex-1"
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") handleTestGeoKey();
                        }}
                      />
                      <button
                        type="button"
                        disabled={geoKeyTesting || !geoApiKey.trim()}
                        className="text-sm text-muted-foreground hover:text-foreground px-2 disabled:opacity-50"
                        onClick={handleTestGeoKey}
                      >
                        {geoKeyTesting
                          ? "..."
                          : geoKeyStatus === "valid"
                            ? "ok"
                            : "test"}
                      </button>
                    </div>
                    {geoKeyStatus === "invalid" && geoKeyError && (
                      <span className="text-xs text-destructive">
                        {geoKeyError}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {integrationTab === "nlp" && (
              <div className="flex flex-col border border-border">
                <div className="text-xs text-muted-foreground px-3 py-1.5">
                  NLP
                </div>
                {NLP_OPTIONS.map((opt, i) => {
                  const selected = nlpProvider === opt.id;
                  const focused = focusIdx === i;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`flex items-center w-full px-3 py-2 text-sm transition-colors ${
                        focused ? "bg-accent" : ""
                      }`}
                      onClick={() => {
                        setFocusIdx(i);
                        if (opt.id !== nlpProvider) {
                          setNlpProvider(opt.id);
                          setNlpKeyStatus(null);
                          setNlpKeyError("");
                          if (!opt.needsKey) {
                            setNlpApiKey("");
                          }
                        }
                      }}
                      onMouseEnter={() => setFocusIdx(i)}
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
                  const focusedNlp = NLP_OPTIONS[focusIdx];
                  return focusedNlp ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground leading-relaxed">
                      {focusedNlp.blurb}
                    </div>
                  ) : null;
                })()}
                {(() => {
                  const selectedOpt = NLP_OPTIONS.find(
                    (o) => o.id === nlpProvider,
                  );
                  if (!selectedOpt?.needsKey) return null;
                  return (
                    <div className="px-3 pb-2 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Input
                          value={nlpApiKey}
                          onChange={(e) => {
                            setNlpApiKey(e.target.value);
                            setNlpKeyStatus(null);
                            setNlpKeyError("");
                          }}
                          placeholder="api key"
                          className="h-8 text-sm flex-1"
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter") handleTestNlpKey();
                          }}
                        />
                        <button
                          type="button"
                          disabled={nlpKeyTesting || !nlpApiKey.trim()}
                          className="text-sm text-muted-foreground hover:text-foreground px-2 disabled:opacity-50"
                          onClick={handleTestNlpKey}
                        >
                          {nlpKeyTesting
                            ? "..."
                            : nlpKeyStatus === "valid"
                              ? "ok"
                              : "test"}
                        </button>
                      </div>
                      {nlpKeyStatus === "invalid" && nlpKeyError && (
                        <span className="text-xs text-destructive">
                          {nlpKeyError}
                        </span>
                      )}
                    </div>
                  );
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
                  submitting ||
                  (GEO_OPTIONS.find((o) => o.id === geoProvider)?.needsKey &&
                    geoKeyStatus !== "valid") ||
                  (NLP_OPTIONS.find((o) => o.id === nlpProvider)?.needsKey &&
                    nlpKeyStatus !== "valid")
                }
                onClick={handleFinish}
              >
                {submitting ? "..." : "finish"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
