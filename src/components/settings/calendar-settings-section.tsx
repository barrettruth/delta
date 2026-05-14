"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
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
  notifyDashboardTasksChanged,
  syncSummaryChangedTasks,
} from "@/lib/dashboard-refresh";
import {
  SETTINGS_RETURN_TO_PARAM,
  safeSettingsReturnTo,
} from "@/lib/settings-navigation";
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
  tasksLastResult: GoogleTasksPullResult | null;
  calendarLastPulledAt: string | null;
  calendarLastError: string | null;
  calendarLastResult: GoogleCalendarPullResult | null;
  calendarSources: GoogleCalendarSource[];
}

interface GoogleTasksPullResult {
  lists: number;
  seen: number;
  created: number;
  updated: number;
  cancelled: number;
  skipped: number;
  duplicateSkipped: number;
  errors: string[];
}

interface GoogleCalendarPullResult {
  sources: number;
  seen: number;
  created: number;
  updated: number;
  cancelled: number;
  skipped: number;
  duplicateSkipped: number;
  fullResyncs: number;
  errors: string[];
}

interface GoogleCalendarSource {
  id: number;
  sourceId: string;
  title: string;
  enabled: boolean;
  hidden: boolean;
  accessRole: string | null;
  timeZone: string | null;
  defaultCategory: string;
  backgroundColor: string | null;
  foregroundColor: string | null;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function formatPullStatus(result: GoogleTasksPullResult): string {
  const parts = [`pulled ${result.seen}`];
  if (result.created > 0) parts.push(`${result.created} created`);
  if (result.updated > 0) parts.push(`${result.updated} updated`);
  if (result.cancelled > 0) parts.push(`${result.cancelled} cancelled`);
  if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
  if (result.duplicateSkipped > 0) {
    parts.push(`${result.duplicateSkipped} duplicate skipped`);
  }
  if (result.errors.length > 0) parts.push(`${result.errors.length} errors`);
  if (parts.length === 1) parts.push("no changes");
  return parts.join(", ");
}

function formatLastResult(result: GoogleTasksPullResult): string {
  const parts = [`${result.seen} seen`];
  if (result.created > 0) parts.push(`${result.created} created`);
  if (result.updated > 0) parts.push(`${result.updated} updated`);
  if (result.cancelled > 0) parts.push(`${result.cancelled} cancelled`);
  if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
  if (result.duplicateSkipped > 0) {
    parts.push(`${result.duplicateSkipped} duplicate skipped`);
  }
  if (result.errors.length > 0) parts.push(`${result.errors.length} errors`);
  if (parts.length === 1) parts.push("no changes");
  return parts.join(" / ");
}

function formatCalendarPullStatus(result: GoogleCalendarPullResult): string {
  const parts = [`pulled ${result.seen}`];
  if (result.created > 0) parts.push(`${result.created} created`);
  if (result.updated > 0) parts.push(`${result.updated} updated`);
  if (result.cancelled > 0) parts.push(`${result.cancelled} cancelled`);
  if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
  if (result.duplicateSkipped > 0) {
    parts.push(`${result.duplicateSkipped} duplicate skipped`);
  }
  if (result.fullResyncs > 0) {
    parts.push(`${result.fullResyncs} full resync`);
  }
  if (result.errors.length > 0) parts.push(`${result.errors.length} errors`);
  if (parts.length === 1) parts.push("no changes");
  return parts.join(", ");
}

function formatCalendarLastResult(result: GoogleCalendarPullResult): string {
  const parts = [`${result.seen} seen`];
  if (result.created > 0) parts.push(`${result.created} created`);
  if (result.updated > 0) parts.push(`${result.updated} updated`);
  if (result.cancelled > 0) parts.push(`${result.cancelled} cancelled`);
  if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
  if (result.duplicateSkipped > 0) {
    parts.push(`${result.duplicateSkipped} duplicate skipped`);
  }
  if (result.fullResyncs > 0) {
    parts.push(`${result.fullResyncs} full resync`);
  }
  if (result.errors.length > 0) parts.push(`${result.errors.length} errors`);
  if (parts.length === 1) parts.push("no changes");
  return parts.join(" / ");
}

function sourceLabel(source: GoogleCalendarSource): string {
  return source.hidden ? `${source.title} [hidden]` : source.title;
}

function sourceValue(source: GoogleCalendarSource): string {
  const state = source.enabled ? "on" : "off";
  return `${state} / ${source.defaultCategory}`;
}

export function CalendarSettingsSection({
  initialGeoProvider = "photon",
  initialFeedToken = null,
  initialNlpProvider = null,
  initialGoogle,
}: {
  initialGeoProvider?: GeocodingProvider;
  initialFeedToken?: string | null;
  initialNlpProvider?: NlpProviderId | null;
  initialGoogle?: GoogleSummary;
}) {
  const statusBar = useStatusBar();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<ProviderTab>("google");
  const [feedToken, setFeedToken] = useState(initialFeedToken);
  const [importingICal, setImportingICal] = useState(false);
  const [google, setGoogle] = useState<GoogleSummary>(
    initialGoogle ?? {
      connected: false,
      email: null,
      name: null,
      tasksLastPulledAt: null,
      tasksLastError: null,
      tasksLastResult: null,
      calendarLastPulledAt: null,
      calendarLastError: null,
      calendarLastResult: null,
      calendarSources: [],
    },
  );
  const [googlePulling, setGooglePulling] = useState(false);
  const [googleCalendarPulling, setGoogleCalendarPulling] = useState(false);
  const [googleCalendarLoading, setGoogleCalendarLoading] = useState(false);
  const [googleCalendarSavingId, setGoogleCalendarSavingId] = useState<
    number | null
  >(null);
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

  function feedUrl(token: string): string {
    return `${window.location.origin}/api/calendar/feed/${token}`;
  }

  async function handleGenerateFeed() {
    const res = await fetch("/api/calendar/feed", { method: "POST" });
    const data = (await res.json()) as { token?: string };
    if (!res.ok || !data.token) {
      statusBar.error("failed to generate subscription url");
      return;
    }
    setFeedToken(data.token);
    statusBar.message("subscription url generated");
  }

  async function handleCopyFeedUrl() {
    if (!feedToken) return;
    await navigator.clipboard.writeText(feedUrl(feedToken));
    statusBar.message("copied to clipboard");
  }

  async function handleRevokeFeed() {
    const res = await fetch("/api/calendar/feed", { method: "DELETE" });
    if (!res.ok) {
      statusBar.error("failed to revoke subscription");
      return;
    }
    setFeedToken(null);
    statusBar.message("subscription url revoked");
  }

  async function handleImportICal() {
    const file = fileRef.current?.files?.[0];
    if (!file || importingICal) return;
    setImportingICal(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/import/ical", { method: "POST", body });
      const data = (await res.json()) as {
        created?: number;
        skipped?: number;
        error?: string;
      };
      if (!res.ok) {
        statusBar.error(data.error ?? "import failed");
        return;
      }
      statusBar.message(
        `imported ${data.created ?? 0} events, skipped ${
          data.skipped ?? 0
        } duplicates`,
      );
      if (fileRef.current) fileRef.current.value = "";
      notifyDashboardTasksChanged();
    } catch (error) {
      statusBar.error(error instanceof Error ? error.message : "import failed");
    } finally {
      setImportingICal(false);
    }
  }

  function handleExportICal() {
    window.location.href = "/api/export/ical";
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
    const returnTo = safeSettingsReturnTo(
      searchParams.get(SETTINGS_RETURN_TO_PARAM),
    );
    const params = new URLSearchParams();
    if (returnTo !== "/") params.set(SETTINGS_RETURN_TO_PARAM, returnTo);
    const query = params.toString();
    window.location.href = `/api/integrations/google/connect${
      query ? `?${query}` : ""
    }`;
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
      tasksLastResult: null,
      calendarLastPulledAt: null,
      calendarLastError: null,
      calendarLastResult: null,
      calendarSources: [],
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
        tasksLastResult: result,
      }));
      statusBar.message(formatPullStatus(result));
      if (syncSummaryChangedTasks(result)) notifyDashboardTasksChanged();
    } catch {
      statusBar.clearOperation();
      statusBar.error("google tasks pull failed");
    } finally {
      setGooglePulling(false);
    }
  }

  async function handleGoogleCalendarRefresh() {
    if (!google.connected || googleCalendarLoading) return;
    setGoogleCalendarLoading(true);
    statusBar.setOperation("refreshing google calendars...");
    try {
      const res = await fetch("/api/integrations/google/calendar-sources", {
        method: "POST",
      });
      const data = (await res.json()) as
        | { sources: GoogleCalendarSource[] }
        | { error?: string };
      statusBar.clearOperation();
      if (!res.ok) {
        statusBar.error(
          "error" in data && data.error
            ? data.error
            : "google calendar refresh failed",
        );
        return;
      }

      setGoogle((current) => ({
        ...current,
        calendarSources: "sources" in data ? data.sources : [],
      }));
      statusBar.message("google calendars refreshed");
    } catch {
      statusBar.clearOperation();
      statusBar.error("google calendar refresh failed");
    } finally {
      setGoogleCalendarLoading(false);
    }
  }

  async function handleGoogleCalendarPull() {
    if (!google.connected || googleCalendarPulling) return;
    setGoogleCalendarPulling(true);
    statusBar.setOperation("pulling google calendar...");
    try {
      const res = await fetch("/api/integrations/google/calendar/pull", {
        method: "POST",
      });
      const data = (await res.json()) as
        | GoogleCalendarPullResult
        | { error?: string };
      statusBar.clearOperation();
      if (!res.ok) {
        statusBar.error(
          "error" in data && data.error
            ? data.error
            : "google calendar pull failed",
        );
        return;
      }

      const result = data as GoogleCalendarPullResult;
      setGoogle((current) => ({
        ...current,
        calendarLastPulledAt: new Date().toISOString(),
        calendarLastError: result.errors[0] ?? null,
        calendarLastResult: result,
      }));
      statusBar.message(formatCalendarPullStatus(result));
      if (syncSummaryChangedTasks(result)) notifyDashboardTasksChanged();
    } catch {
      statusBar.clearOperation();
      statusBar.error("google calendar pull failed");
    } finally {
      setGoogleCalendarPulling(false);
    }
  }

  async function handleGoogleCalendarToggle(source: GoogleCalendarSource) {
    if (!google.connected || googleCalendarSavingId !== null) return;
    setGoogleCalendarSavingId(source.id);
    try {
      const res = await fetch(
        `/api/integrations/google/calendar-sources/${source.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !source.enabled }),
        },
      );
      const data = (await res.json()) as
        | GoogleCalendarSource
        | { error?: string };
      if (!res.ok) {
        statusBar.error(
          "error" in data && data.error
            ? data.error
            : "failed to update google calendar",
        );
        return;
      }

      const updated = data as GoogleCalendarSource;
      setGoogle((current) => ({
        ...current,
        calendarSources: current.calendarSources.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      }));
      statusBar.message(
        `${updated.enabled ? "enabled" : "disabled"} ${updated.title}`,
      );
    } catch {
      statusBar.error("failed to update google calendar");
    } finally {
      setGoogleCalendarSavingId(null);
    }
  }

  function lastPulledLabel(): string {
    if (!google.tasksLastPulledAt) return "never";
    return formatTimestamp(google.tasksLastPulledAt);
  }

  function calendarLastPulledLabel(): string {
    if (!google.calendarLastPulledAt) return "never";
    return formatTimestamp(google.calendarLastPulledAt);
  }

  function tasksPullLabel(): string {
    if (googlePulling) return "pulling google tasks...";
    return `pull now (last pull: ${lastPulledLabel()})`;
  }

  function calendarPullLabel(): string {
    if (googleCalendarPulling) return "pulling calendars...";
    return `pull now (last pull: ${calendarLastPulledLabel()})`;
  }

  function calendarRefreshLabel(): string {
    if (googleCalendarLoading) return "refreshing calendars...";
    if (google.calendarSources.length === 0) {
      return "refresh calendars (no calendars discovered)";
    }
    return "refresh calendars";
  }

  const tasksLastResult = google.tasksLastResult;
  const calendarLastResult = google.calendarLastResult;

  return (
    <SettingsPage
      title="calendar"
      description="Manage the providers delta uses for Google sync, location lookup, and recurrence parsing."
    >
      <div className="space-y-6">
        <SettingsSection title="local calendar">
          {feedToken ? (
            <>
              <SettingsRow
                label="copy subscription url"
                action
                onClick={handleCopyFeedUrl}
              />
              <SettingsRow
                label="revoke subscription"
                action
                destructive
                prefix={{ text: "-", className: "text-destructive" }}
                onClick={handleRevokeFeed}
              />
            </>
          ) : (
            <SettingsRow
              label="generate subscription"
              action
              prefix={{ text: "+", className: "text-status-done" }}
              onClick={handleGenerateFeed}
            />
          )}
          <SettingsRow
            label={importingICal ? "importing .ics..." : "import .ics"}
            action={!importingICal}
            muted={importingICal}
            prefix={{ text: "+", className: "text-status-done" }}
            onClick={() => fileRef.current?.click()}
          />
          <SettingsRow label="export .ics" action onClick={handleExportICal} />
        </SettingsSection>
        <input
          ref={fileRef}
          type="file"
          accept=".ics"
          className="hidden"
          onChange={handleImportICal}
        />

        <div className="grid grid-cols-3 border border-border/60">
          {(
            [
              ["google", "google"],
              ["geocoding", "geocoding"],
              ["nlp", "recurrence"],
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
              description="Pull Google Tasks into read-only Delta tasks without creating duplicates."
            >
              <SettingsRow
                label={tasksPullLabel()}
                value={google.connected ? "" : "not connected"}
                action={google.connected && !googlePulling}
                muted={!google.connected}
                onClick={handleGoogleTasksPull}
              />
              {tasksLastResult && (
                <SettingsRow
                  label="last result"
                  value={formatLastResult(tasksLastResult)}
                />
              )}
              {google.tasksLastError && (
                <SettingsRow
                  label={google.tasksLastError}
                  value="error"
                  destructive
                />
              )}
            </SettingsSection>

            <SettingsSection
              title="google calendars"
              description="Choose which Google calendars Delta should import as read-only events."
            >
              <SettingsRow
                label={calendarPullLabel()}
                value={google.connected ? "" : "not connected"}
                action={google.connected && !googleCalendarPulling}
                muted={!google.connected}
                onClick={handleGoogleCalendarPull}
              />
              {calendarLastResult && (
                <SettingsRow
                  label="last result"
                  value={formatCalendarLastResult(calendarLastResult)}
                />
              )}
              {google.calendarLastError && (
                <SettingsRow
                  label={google.calendarLastError}
                  value="error"
                  destructive
                />
              )}
              <SettingsRow
                label={calendarRefreshLabel()}
                value={google.connected ? "" : "not connected"}
                action={google.connected && !googleCalendarLoading}
                muted={!google.connected}
                onClick={handleGoogleCalendarRefresh}
              />
              {google.calendarSources.length > 0 &&
                google.calendarSources.map((source) => (
                  <SettingsRow
                    key={source.id}
                    label={
                      googleCalendarSavingId === source.id
                        ? "saving..."
                        : sourceLabel(source)
                    }
                    value={sourceValue(source)}
                    action={
                      google.connected && googleCalendarSavingId !== source.id
                    }
                    muted={!source.enabled}
                    prefix={{
                      text: source.enabled ? "+" : "-",
                      className: source.enabled
                        ? "text-status-done"
                        : "text-muted-foreground",
                    }}
                    onClick={() => handleGoogleCalendarToggle(source)}
                  />
                ))}
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
