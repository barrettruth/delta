"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStatusBar } from "@/contexts/status-bar";
import { GEOCODING_PROVIDER } from "@/core/geocoding";
import type { NlpProvider } from "@/lib/nlp-models";
import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "./settings-primitives";

type ProviderTab = "geocoding" | "nlp";

const NLP_PROVIDERS_LIST: { id: "builtin" | NlpProvider; label: string }[] = [
  { id: "builtin", label: "built-in" },
  { id: "anthropic", label: "anthropic" },
  { id: "openai", label: "openai" },
];

export function CalendarSettingsSection({
  initialNlpProvider = null,
}: {
  initialNlpProvider?: NlpProvider | null;
}) {
  const statusBar = useStatusBar();

  const [activeTab, setActiveTab] = useState<ProviderTab>("geocoding");

  const [nlpActive, setNlpActive] = useState<"builtin" | NlpProvider>(
    initialNlpProvider ?? "builtin",
  );
  const [nlpKeyInput, setNlpKeyInput] = useState("");
  const [nlpKeyTarget, setNlpKeyTarget] = useState<NlpProvider | null>(null);
  const [nlpKeyTesting, setNlpKeyTesting] = useState(false);

  async function handleSelectNlpProvider(id: "builtin" | NlpProvider) {
    if (id === "builtin") {
      await fetch("/api/settings/nlp", { method: "DELETE" });
      setNlpActive("builtin");
      setNlpKeyTarget(null);
      statusBar.message("recurrence parsing set to built-in");
      return;
    }
    setNlpActive(id);
    setNlpKeyTarget(id);
    setNlpKeyInput("");
  }

  async function handleTestNlpKey() {
    if (!nlpKeyInput.trim() || !nlpKeyTarget) return;
    setNlpKeyTesting(true);
    try {
      const res = await fetch("/api/settings/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: nlpKeyTarget,
          apiKey: nlpKeyInput.trim(),
        }),
      });
      const data = await res.json();
      if (data.valid) {
        statusBar.message("key is valid");
        await handleSaveNlpKey();
      } else {
        statusBar.error(data.error ?? "invalid api key");
      }
    } catch {
      statusBar.error("connection failed");
    } finally {
      setNlpKeyTesting(false);
    }
  }

  async function handleSaveNlpKey() {
    if (!nlpKeyInput.trim()) {
      statusBar.error("api key cannot be empty");
      return;
    }
    const provider = nlpKeyTarget;
    if (!provider) return;
    const res = await fetch("/api/settings/nlp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey: nlpKeyInput.trim() }),
    });
    if (!res.ok) {
      statusBar.error("failed to save recurrence parser config");
      return;
    }
    setNlpKeyTarget(null);
    setNlpKeyInput("");
    statusBar.message(`recurrence parsing set to ${provider}`);
  }

  return (
    <SettingsPage
      title="calendar"
      description="Manage location lookup and recurrence parsing."
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 border border-border/60">
          {(
            [
              ["geocoding", "geocoding"],
              ["nlp", "NLP"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`px-3 py-2.5 text-sm transition-colors ${
                activeTab === id
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/40"
              }`}
              onClick={() => setActiveTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "geocoding" && (
          <SettingsSection
            title="location lookup"
            description="Built-in geocoding for location suggestions."
          >
            <SettingsRow label={GEOCODING_PROVIDER.label} value="active" />
          </SettingsSection>
        )}

        {activeTab === "nlp" && (
          <SettingsSection
            title="recurrence parsing"
            description="Choose the parser used for natural-language input."
          >
            {NLP_PROVIDERS_LIST.map((provider) => (
              <div key={provider.id}>
                <SettingsRow
                  label={provider.label}
                  value={nlpActive === provider.id ? "active" : ""}
                  action
                  muted={nlpActive !== provider.id}
                  onClick={() => handleSelectNlpProvider(provider.id)}
                />
                {nlpKeyTarget === provider.id && (
                  <div className="flex gap-2 px-2 py-1">
                    <Input
                      value={nlpKeyInput}
                      onChange={(e) => setNlpKeyInput(e.target.value)}
                      placeholder="api key"
                      type="password"
                      autoFocus
                      className="h-8 flex-1 text-sm"
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") handleTestNlpKey();
                        if (e.key === "Escape") {
                          setNlpKeyTarget(null);
                          setNlpKeyInput("");
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={nlpKeyTesting || !nlpKeyInput.trim()}
                      onClick={handleTestNlpKey}
                      className="h-8 text-sm"
                    >
                      {nlpKeyTesting ? "..." : "test & save"}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </SettingsSection>
        )}
      </div>
    </SettingsPage>
  );
}
