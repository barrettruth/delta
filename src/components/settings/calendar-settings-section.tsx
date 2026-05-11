"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStatusBar } from "@/contexts/status-bar";
import {
  NLP_SETTINGS_PROVIDERS,
  type NlpProviderId,
  type NlpSettingsProviderId,
} from "@/core/provider-registry";
import {
  GEOCODING_PROVIDERS,
  type GeocodingApiKeyProvider,
  type GeocodingProvider,
  geocodingProviderLabel,
  geocodingProvidersToClear,
  geocodingTokens,
  isGeocodingApiKeyProvider,
} from "@/lib/geocoding-providers";
import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "./settings-primitives";

type ProviderTab = "geocoding" | "nlp";

export function CalendarSettingsSection({
  initialGeoProvider = "photon",
  initialNlpProvider = null,
}: {
  initialGeoProvider?: GeocodingProvider;
  initialNlpProvider?: NlpProviderId | null;
}) {
  const statusBar = useStatusBar();

  const [activeTab, setActiveTab] = useState<ProviderTab>("geocoding");
  const [geoProvider, setGeoProvider] =
    useState<GeocodingProvider>(initialGeoProvider);
  const [geoKeyInput, setGeoKeyInput] = useState("");
  const [geoKeyTarget, setGeoKeyTarget] =
    useState<GeocodingApiKeyProvider | null>(null);
  const [geoKeyTesting, setGeoKeyTesting] = useState(false);

  const [nlpActive, setNlpActive] = useState<NlpSettingsProviderId>(
    initialNlpProvider ?? "builtin",
  );
  const [nlpKeyInput, setNlpKeyInput] = useState("");
  const [nlpKeyTarget, setNlpKeyTarget] = useState<NlpProviderId | null>(null);
  const [nlpKeyTesting, setNlpKeyTesting] = useState(false);

  async function handleSelectGeoProvider(id: GeocodingProvider) {
    if (!isGeocodingApiKeyProvider(id)) {
      const res = await fetch("/api/settings/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: id, tokens: {} }),
      });
      if (!res.ok) {
        statusBar.error("failed to save location lookup config");
        return;
      }

      for (const provider of geocodingProvidersToClear(id)) {
        await fetch(`/api/settings/integrations/${provider}`, {
          method: "DELETE",
        });
      }
      setGeoProvider(id);
      setGeoKeyTarget(null);
      setGeoKeyInput("");
      statusBar.message(`location lookup set to ${geocodingProviderLabel(id)}`);
      return;
    }
    setGeoKeyTarget(id);
    setGeoKeyInput("");
    setGeoProvider(id);
  }

  async function handleTestGeoKey() {
    if (!geoKeyInput.trim() || !geoKeyTarget) return;
    setGeoKeyTesting(true);
    try {
      const res = await fetch("/api/settings/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: geoKeyTarget,
          apiKey: geoKeyInput.trim(),
        }),
      });
      const data = await res.json();
      if (data.valid) {
        statusBar.message("key is valid");
        await handleSaveGeoKey();
      } else {
        statusBar.error(data.error ?? "invalid api key");
      }
    } catch {
      statusBar.error("connection failed");
    } finally {
      setGeoKeyTesting(false);
    }
  }

  async function handleSaveGeoKey() {
    if (!geoKeyInput.trim()) {
      statusBar.error("api key cannot be empty");
      return;
    }
    const provider = geoKeyTarget;
    if (!provider) return;

    const res = await fetch("/api/settings/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        tokens: geocodingTokens(geoKeyInput.trim()),
      }),
    });
    if (!res.ok) {
      statusBar.error("failed to save api key");
      return;
    }
    for (const staleProvider of geocodingProvidersToClear(provider)) {
      await fetch(`/api/settings/integrations/${staleProvider}`, {
        method: "DELETE",
      });
    }
    setGeoProvider(provider);
    setGeoKeyTarget(null);
    setGeoKeyInput("");
    statusBar.message(
      `location lookup set to ${geocodingProviderLabel(provider)}`,
    );
  }

  async function handleSelectNlpProvider(id: NlpSettingsProviderId) {
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
      description="Manage the providers delta uses for location lookup and recurrence parsing."
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
            description="Choose the provider used for location and meeting lookups."
          >
            {GEOCODING_PROVIDERS.map((provider) => (
              <div key={provider.id}>
                <SettingsRow
                  label={provider.label}
                  value={geoProvider === provider.id ? "active" : ""}
                  action
                  muted={geoProvider !== provider.id}
                  onClick={() => handleSelectGeoProvider(provider.id)}
                />
                {geoKeyTarget === provider.id && (
                  <div className="flex gap-2 px-2 py-1">
                    <Input
                      value={geoKeyInput}
                      onChange={(e) => setGeoKeyInput(e.target.value)}
                      placeholder="api key"
                      autoFocus
                      className="h-8 flex-1 text-sm"
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") handleTestGeoKey();
                        if (e.key === "Escape") {
                          setGeoKeyTarget(null);
                          setGeoKeyInput("");
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={geoKeyTesting || !geoKeyInput.trim()}
                      onClick={handleTestGeoKey}
                      className="h-8 text-sm"
                    >
                      {geoKeyTesting ? "..." : "test & save"}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </SettingsSection>
        )}

        {activeTab === "nlp" && (
          <SettingsSection
            title="recurrence parsing"
            description="Choose the parser used for natural-language input."
          >
            {NLP_SETTINGS_PROVIDERS.map((provider) => (
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
