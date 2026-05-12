"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStatusBar } from "@/contexts/status-bar";
import {
  GEOCODING_PROVIDERS,
  type GeocodingApiKeyProvider,
  type GeocodingProvider,
  geocodingProviderLabel,
  isGeocodingApiKeyProvider,
  NLP_SETTINGS_PROVIDERS,
  type NlpProviderId,
  type NlpSettingsProviderId,
} from "@/core/provider-registry";
import {
  ProviderSettingsList,
  testSettingsProviderApiKey,
  useProviderKeyEditor,
} from "./provider-settings-primitives";
import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "./settings-primitives";

type ProviderTab = "google" | "geocoding" | "nlp";

interface GoogleSummary {
  connected: boolean;
  email: string | null;
  name: string | null;
  tasksLastPulledAt: string | null;
  tasksLastError: string | null;
}

interface GoogleTasksPullResult {
  lists: number;
  seen: number;
  created: number;
  updated: number;
  cancelled: number;
  skipped: number;
}

export function CalendarSettingsSection({
  initialGeoProvider = "photon",
  initialNlpProvider = null,
  initialGoogle,
}: {
  initialGeoProvider?: GeocodingProvider;
  initialNlpProvider?: NlpProviderId | null;
  initialGoogle?: GoogleSummary;
}) {
  const statusBar = useStatusBar();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<ProviderTab>("google");
  const [google, setGoogle] = useState<GoogleSummary>(
    initialGoogle ?? {
      connected: false,
      email: null,
      name: null,
      tasksLastPulledAt: null,
      tasksLastError: null,
    },
  );
  const [googlePulling, setGooglePulling] = useState(false);
  const [geoProvider, setGeoProvider] =
    useState<GeocodingProvider>(initialGeoProvider);
  const geoKey = useProviderKeyEditor<GeocodingApiKeyProvider>();

  const [nlpActive, setNlpActive] = useState<NlpSettingsProviderId>(
    initialNlpProvider ?? "builtin",
  );
  const nlpKey = useProviderKeyEditor<NlpProviderId>();

  async function saveGeoProvider(provider: GeocodingProvider, apiKey?: string) {
    return fetch("/api/settings/geocoding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey }),
    });
  }

  async function handleSelectGeoProvider(id: GeocodingProvider) {
    if (!isGeocodingApiKeyProvider(id)) {
      const res = await saveGeoProvider(id);
      if (!res.ok) {
        statusBar.error("failed to save location lookup config");
        return;
      }

      setGeoProvider(id);
      geoKey.close();
      statusBar.message(`location lookup set to ${geocodingProviderLabel(id)}`);
      return;
    }
    geoKey.open(id);
    setGeoProvider(id);
  }

  async function handleTestGeoKey() {
    if (!geoKey.input.trim() || !geoKey.target) return;
    geoKey.setTesting(true);
    try {
      const data = await testSettingsProviderApiKey(
        geoKey.target,
        geoKey.input.trim(),
      );
      if (data.valid) {
        statusBar.message("key is valid");
        await handleSaveGeoKey();
      } else {
        statusBar.error(data.error ?? "invalid api key");
      }
    } catch {
      statusBar.error("connection failed");
    } finally {
      geoKey.setTesting(false);
    }
  }

  async function handleSaveGeoKey() {
    if (!geoKey.input.trim()) {
      statusBar.error("api key cannot be empty");
      return;
    }
    const provider = geoKey.target;
    if (!provider) return;

    const res = await saveGeoProvider(provider, geoKey.input.trim());
    if (!res.ok) {
      statusBar.error("failed to save api key");
      return;
    }
    setGeoProvider(provider);
    geoKey.close();
    statusBar.message(
      `location lookup set to ${geocodingProviderLabel(provider)}`,
    );
  }

  async function handleSelectNlpProvider(id: NlpSettingsProviderId) {
    if (id === "builtin") {
      await fetch("/api/settings/nlp", { method: "DELETE" });
      setNlpActive("builtin");
      nlpKey.close();
      statusBar.message("recurrence parsing set to built-in");
      return;
    }
    setNlpActive(id);
    nlpKey.open(id);
  }

  async function handleTestNlpKey() {
    if (!nlpKey.input.trim() || !nlpKey.target) return;
    nlpKey.setTesting(true);
    try {
      const data = await testSettingsProviderApiKey(
        nlpKey.target,
        nlpKey.input.trim(),
      );
      if (data.valid) {
        statusBar.message("key is valid");
        await handleSaveNlpKey();
      } else {
        statusBar.error(data.error ?? "invalid api key");
      }
    } catch {
      statusBar.error("connection failed");
    } finally {
      nlpKey.setTesting(false);
    }
  }

  async function handleSaveNlpKey() {
    if (!nlpKey.input.trim()) {
      statusBar.error("api key cannot be empty");
      return;
    }
    const provider = nlpKey.target;
    if (!provider) return;
    const res = await fetch("/api/settings/nlp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey: nlpKey.input.trim() }),
    });
    if (!res.ok) {
      statusBar.error("failed to save recurrence parser config");
      return;
    }
    nlpKey.close();
    statusBar.message(`recurrence parsing set to ${provider}`);
  }

  function handleGoogleConnect() {
    window.location.href = "/api/integrations/google/connect";
  }

  async function handleGoogleDisconnect() {
    const res = await fetch("/api/integrations/google", { method: "DELETE" });
    if (!res.ok) {
      statusBar.error("failed to disconnect google");
      return;
    }
    setGoogle({
      connected: false,
      email: null,
      name: null,
      tasksLastPulledAt: null,
      tasksLastError: null,
    });
    statusBar.message("google disconnected");
    router.refresh();
  }

  async function handleGoogleTasksPull() {
    if (!google.connected || googlePulling) return;
    setGooglePulling(true);
    statusBar.setOperation("pulling google tasks...");
    try {
      const res = await fetch("/api/integrations/google/tasks/pull", {
        method: "POST",
      });
      const data = (await res.json()) as
        | GoogleTasksPullResult
        | { error?: string };
      statusBar.clearOperation();
      if (!res.ok) {
        statusBar.error(
          "error" in data && data.error
            ? data.error
            : "google tasks pull failed",
        );
        return;
      }

      const result = data as GoogleTasksPullResult;
      setGoogle((current) => ({
        ...current,
        tasksLastPulledAt: new Date().toISOString(),
        tasksLastError: null,
      }));
      statusBar.message(
        `pulled ${result.created} new, updated ${result.updated}, cancelled ${result.cancelled}`,
      );
      router.refresh();
    } catch {
      statusBar.clearOperation();
      statusBar.error("google tasks pull failed");
    } finally {
      setGooglePulling(false);
    }
  }

  function lastPulledLabel(): string {
    if (!google.tasksLastPulledAt) return "never";
    return new Date(google.tasksLastPulledAt).toLocaleString();
  }

  return (
    <SettingsPage
      title="calendar"
      description="Manage the providers delta uses for Google sync, location lookup, and recurrence parsing."
    >
      <div className="space-y-6">
        <div className="grid grid-cols-3 border border-border/60">
          {(
            [
              ["google", "google"],
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

        {activeTab === "google" && (
          <div className="space-y-6">
            <SettingsSection
              title="google account"
              description="Connect one Google account for first-party calendar and task sync."
            >
              {google.connected ? (
                <>
                  <SettingsRow
                    label={google.email ?? google.name ?? "google"}
                    value="connected"
                  />
                  <SettingsRow
                    label="disconnect"
                    action
                    destructive
                    prefix={{ text: "-", className: "text-destructive" }}
                    onClick={handleGoogleDisconnect}
                  />
                </>
              ) : (
                <SettingsRow
                  label="connect google"
                  action
                  prefix={{ text: "+", className: "text-status-done" }}
                  onClick={handleGoogleConnect}
                />
              )}
            </SettingsSection>

            <SettingsSection
              title="google tasks"
              description="Pull Google Tasks into delta without creating duplicates."
            >
              <SettingsRow
                label={googlePulling ? "pulling google tasks..." : "pull now"}
                value={google.connected ? "" : "not connected"}
                action={google.connected && !googlePulling}
                muted={!google.connected}
                onClick={handleGoogleTasksPull}
              />
              <SettingsRow label="last pull" value={lastPulledLabel()} />
              {google.tasksLastError && (
                <SettingsRow
                  label={google.tasksLastError}
                  value="error"
                  destructive
                />
              )}
            </SettingsSection>
          </div>
        )}

        {activeTab === "geocoding" && (
          <SettingsSection
            title="location lookup"
            description="Choose the provider used for location and meeting lookups."
          >
            <ProviderSettingsList
              activeProvider={geoProvider}
              keyInput={geoKey.input}
              keyTarget={geoKey.target}
              keyTesting={geoKey.testing}
              onCancelKeyInput={geoKey.close}
              onKeyInputChange={geoKey.setInput}
              onProviderSelect={handleSelectGeoProvider}
              onTestKey={handleTestGeoKey}
              providers={GEOCODING_PROVIDERS}
            />
          </SettingsSection>
        )}

        {activeTab === "nlp" && (
          <SettingsSection
            title="recurrence parsing"
            description="Choose the parser used for natural-language input."
          >
            <ProviderSettingsList
              activeProvider={nlpActive}
              inputType="password"
              keyInput={nlpKey.input}
              keyTarget={nlpKey.target}
              keyTesting={nlpKey.testing}
              onCancelKeyInput={nlpKey.close}
              onKeyInputChange={nlpKey.setInput}
              onProviderSelect={handleSelectNlpProvider}
              onTestKey={handleTestNlpKey}
              providers={NLP_SETTINGS_PROVIDERS}
            />
          </SettingsSection>
        )}
      </div>
    </SettingsPage>
  );
}
