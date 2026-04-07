"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReminderEndpointsSection } from "@/components/settings/reminder-endpoints-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStatusBar } from "@/contexts/status-bar";
import type { ReminderEndpointRecord } from "@/core/reminders/endpoints";
import type { ReminderAdapterManifest } from "@/core/reminders/types";
import type { NlpProvider } from "@/lib/nlp-models";
import type { ReminderTransportConfigStatus } from "@/lib/reminder-transport-form";
import {
  SettingsPage,
  SettingsRow,
  SettingsSection,
} from "./settings-primitives";

type GeoProvider = "photon" | "mapbox" | "google_maps";
type ConflictResolution = "lww" | "google_wins" | "delta_wins";
type SyncInterval = 5 | 15 | 30;

const GEO_PROVIDERS: { id: GeoProvider; label: string }[] = [
  { id: "photon", label: "photon" },
  { id: "mapbox", label: "mapbox" },
  { id: "google_maps", label: "google maps" },
];

const CONFLICT_STRATEGIES: { id: ConflictResolution; label: string }[] = [
  { id: "google_wins", label: "google wins" },
  { id: "delta_wins", label: "delta wins" },
  { id: "lww", label: "last write wins" },
];

const SYNC_INTERVALS: { id: SyncInterval; label: string }[] = [
  { id: 5, label: "5 minutes" },
  { id: 15, label: "15 minutes" },
  { id: 30, label: "30 minutes" },
];

const NLP_PROVIDERS_LIST: { id: "builtin" | NlpProvider; label: string }[] = [
  { id: "builtin", label: "built-in" },
  { id: "anthropic", label: "anthropic" },
  { id: "openai", label: "openai" },
];

export function IntegrationsSection({
  gcalConnected,
  initialGeoProvider = "photon",
  initialConflictResolution = "google_wins",
  initialSyncInterval = 5,
  initialNlpProvider = null,
  initialReminderEndpoints = [],
  initialReminderTransportConfigs = [],
  reminderAdapters = [],
}: {
  gcalConnected: boolean;
  initialGeoProvider?: GeoProvider;
  initialConflictResolution?: ConflictResolution;
  initialSyncInterval?: SyncInterval;
  initialNlpProvider?: NlpProvider | null;
  initialReminderEndpoints?: ReminderEndpointRecord[];
  initialReminderTransportConfigs?: ReminderTransportConfigStatus[];
  reminderAdapters?: ReminderAdapterManifest[];
}) {
  const router = useRouter();
  const statusBar = useStatusBar();

  const [geoProvider, setGeoProvider] =
    useState<GeoProvider>(initialGeoProvider);
  const [geoKeyInput, setGeoKeyInput] = useState("");
  const [geoKeyTarget, setGeoKeyTarget] = useState<GeoProvider | null>(null);
  const [geoKeyTesting, setGeoKeyTesting] = useState(false);

  const [conflictResolution, setConflictResolution] =
    useState<ConflictResolution>(initialConflictResolution);
  const [syncInterval, setSyncInterval] =
    useState<SyncInterval>(initialSyncInterval);

  const [nlpActive, setNlpActive] = useState<"builtin" | NlpProvider>(
    initialNlpProvider ?? "builtin",
  );
  const [nlpKeyInput, setNlpKeyInput] = useState("");
  const [nlpKeyTarget, setNlpKeyTarget] = useState<NlpProvider | null>(null);
  const [nlpKeyTesting, setNlpKeyTesting] = useState(false);

  async function handleConnectGcal() {
    window.location.href = "/api/auth/google?scope=calendar";
  }

  async function handleDisconnectGcal() {
    const res = await fetch("/api/settings/integrations/google_calendar", {
      method: "DELETE",
    });
    if (!res.ok) {
      statusBar.error("failed to disconnect");
      return;
    }
    statusBar.message("google calendar disconnected");
    router.refresh();
  }

  async function handleSelectGeoProvider(id: GeoProvider) {
    if (id === "photon") {
      for (const p of ["mapbox", "google_maps"]) {
        await fetch(`/api/settings/integrations/${p}`, { method: "DELETE" });
      }
      setGeoProvider("photon");
      setGeoKeyTarget(null);
      statusBar.message("geocoding set to photon");
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
      GEO_PROVIDERS.find((p) => p.id === geoProvider)?.label ?? geoProvider;
    statusBar.message(`geocoding set to ${label}`);
  }

  async function handleSelectConflictResolution(id: ConflictResolution) {
    const res = await fetch("/api/settings/integrations/google_calendar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata: { conflictResolution: id } }),
    });
    if (!res.ok) {
      statusBar.error("failed to update sync strategy");
      return;
    }
    setConflictResolution(id);
    const label = CONFLICT_STRATEGIES.find((s) => s.id === id)?.label ?? id;
    statusBar.message(`sync strategy set to ${label}`);
  }

  async function handleSelectSyncInterval(id: SyncInterval) {
    const res = await fetch("/api/settings/integrations/google_calendar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata: { syncInterval: id } }),
    });
    if (!res.ok) {
      statusBar.error("failed to update sync interval");
      return;
    }
    setSyncInterval(id);
    const label = SYNC_INTERVALS.find((s) => s.id === id)?.label ?? `${id}m`;
    statusBar.message(`sync interval set to ${label}`);
  }

  async function handleSelectNlpProvider(id: "builtin" | NlpProvider) {
    if (id === "builtin") {
      await fetch("/api/settings/nlp", { method: "DELETE" });
      setNlpActive("builtin");
      setNlpKeyTarget(null);
      statusBar.message("NLP set to built-in");
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
      statusBar.error("failed to save nlp config");
      return;
    }
    setNlpKeyTarget(null);
    setNlpKeyInput("");
    statusBar.message(`NLP set to ${provider}`);
  }

  return (
    <SettingsPage>
      <SettingsSection title="google calendar">
        {gcalConnected ? (
          <SettingsRow
            label="disconnect google calendar"
            action
            muted
            prefix={{ text: "-", className: "text-destructive" }}
            onClick={handleDisconnectGcal}
          />
        ) : (
          <SettingsRow
            label="connect google calendar"
            action
            muted
            prefix={{ text: "+", className: "text-status-done" }}
            onClick={handleConnectGcal}
          />
        )}

        {gcalConnected && (
          <>
            <div className="mt-4 mb-1 px-2 text-xs text-muted-foreground/60 uppercase tracking-wider">
              sync strategy
            </div>
            {CONFLICT_STRATEGIES.map((s) => (
              <SettingsRow
                key={s.id}
                label={s.label}
                value={conflictResolution === s.id ? "active" : ""}
                action
                muted={conflictResolution !== s.id}
                onClick={() => handleSelectConflictResolution(s.id)}
              />
            ))}

            <div className="mt-4 mb-1 px-2 text-xs text-muted-foreground/60 uppercase tracking-wider">
              sync interval
            </div>
            {SYNC_INTERVALS.map((s) => (
              <SettingsRow
                key={s.id}
                label={s.label}
                value={syncInterval === s.id ? "active" : ""}
                action
                muted={syncInterval !== s.id}
                onClick={() => handleSelectSyncInterval(s.id)}
              />
            ))}
          </>
        )}
      </SettingsSection>

      <SettingsSection title="geocoding">
        {GEO_PROVIDERS.map((p) => (
          <div key={p.id}>
            <SettingsRow
              label={p.label}
              value={geoProvider === p.id ? "active" : ""}
              action
              muted={geoProvider !== p.id}
              onClick={() => handleSelectGeoProvider(p.id)}
            />
            {geoKeyTarget === p.id && (
              <div className="flex gap-2 px-2 py-1">
                <Input
                  value={geoKeyInput}
                  onChange={(e) => setGeoKeyInput(e.target.value)}
                  placeholder="api key"
                  autoFocus
                  className="h-7 text-sm flex-1"
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

      <SettingsSection title="recurrence NLP">
        {NLP_PROVIDERS_LIST.map((p) => (
          <div key={p.id}>
            <SettingsRow
              label={p.label}
              value={nlpActive === p.id ? "active" : ""}
              action
              muted={nlpActive !== p.id}
              onClick={() => handleSelectNlpProvider(p.id)}
            />
            {nlpKeyTarget === p.id && (
              <div className="flex gap-2 px-2 py-1">
                <Input
                  value={nlpKeyInput}
                  onChange={(e) => setNlpKeyInput(e.target.value)}
                  placeholder="api key"
                  type="password"
                  autoFocus
                  className="h-7 text-sm flex-1"
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

      <ReminderEndpointsSection
        initialEndpoints={initialReminderEndpoints}
        initialTransportConfigs={initialReminderTransportConfigs}
        adapters={reminderAdapters}
      />
    </SettingsPage>
  );
}
