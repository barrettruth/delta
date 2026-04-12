"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStatusBar } from "@/contexts/status-bar";
import type { NlpProvider } from "@/lib/nlp-models";
import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "./settings-primitives";

type GeoProvider = "photon" | "mapbox" | "google_maps";

const GEO_PROVIDERS: { id: GeoProvider; label: string }[] = [
  { id: "photon", label: "photon" },
  { id: "mapbox", label: "mapbox" },
  { id: "google_maps", label: "google maps" },
];

const NLP_PROVIDERS_LIST: { id: "builtin" | NlpProvider; label: string }[] = [
  { id: "builtin", label: "built-in" },
  { id: "anthropic", label: "anthropic" },
  { id: "openai", label: "openai" },
];

export function CalendarSettingsSection({
  initialGeoProvider = "photon",
  initialNlpProvider = null,
}: {
  initialGeoProvider?: GeoProvider;
  initialNlpProvider?: NlpProvider | null;
}) {
  const statusBar = useStatusBar();

  const [geoProvider, setGeoProvider] =
    useState<GeoProvider>(initialGeoProvider);
  const [geoKeyInput, setGeoKeyInput] = useState("");
  const [geoKeyTarget, setGeoKeyTarget] = useState<GeoProvider | null>(null);
  const [geoKeyTesting, setGeoKeyTesting] = useState(false);

  const [nlpActive, setNlpActive] = useState<"builtin" | NlpProvider>(
    initialNlpProvider ?? "builtin",
  );
  const [nlpKeyInput, setNlpKeyInput] = useState("");
  const [nlpKeyTarget, setNlpKeyTarget] = useState<NlpProvider | null>(null);
  const [nlpKeyTesting, setNlpKeyTesting] = useState(false);

  async function handleSelectGeoProvider(id: GeoProvider) {
    if (id === "photon") {
      for (const provider of ["mapbox", "google_maps"]) {
        await fetch(`/api/settings/integrations/${provider}`, {
          method: "DELETE",
        });
      }
      setGeoProvider("photon");
      setGeoKeyTarget(null);
      statusBar.message("location lookup set to photon");
      return;
    }
    setGeoKeyTarget(id);
    setGeoKeyInput("");
    setGeoProvider(id);
  }

  async function handleTestGeoKey() {
    if (!geoKeyInput.trim()) return;
    setGeoKeyTesting(true);
    try {
      const res = await fetch("/api/settings/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: geoProvider,
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
    const res = await fetch("/api/settings/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: geoProvider,
        tokens: { api_key: geoKeyInput.trim() },
      }),
    });
    if (!res.ok) {
      statusBar.error("failed to save api key");
      return;
    }
    const other = geoProvider === "mapbox" ? "google_maps" : "mapbox";
    await fetch(`/api/settings/integrations/${other}`, { method: "DELETE" });
    setGeoKeyTarget(null);
    setGeoKeyInput("");
    const label =
      GEO_PROVIDERS.find((provider) => provider.id === geoProvider)?.label ??
      geoProvider;
    statusBar.message(`location lookup set to ${label}`);
  }

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
      className="max-w-6xl"
      title="calendar"
      description="Manage the providers delta uses for location lookup and recurrence parsing."
    >
      <div className="grid gap-6 xl:grid-cols-2">
        <SettingsSection
          title="location lookup"
          description="Choose the provider used for location and meeting lookups."
        >
          {GEO_PROVIDERS.map((provider) => (
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
                    className="h-7 flex-1 text-sm"
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
                    className="h-7 text-xs"
                  >
                    {geoKeyTesting ? "..." : "test & save"}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </SettingsSection>

        <SettingsSection
          title="recurrence parsing"
          description="Choose the parser used for natural-language recurrence input."
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
                    className="h-7 flex-1 text-sm"
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
                    className="h-7 text-xs"
                  >
                    {nlpKeyTesting ? "..." : "test & save"}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </SettingsSection>
      </div>
    </SettingsPage>
  );
}
