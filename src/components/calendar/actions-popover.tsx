"use client";

import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useStatusBar } from "@/contexts/status-bar";
import type { NlpProvider } from "@/lib/nlp-models";
import { NLP_MODELS } from "@/lib/nlp-models";

interface GcalStatus {
  connected: boolean;
  lastSyncTime: string | null;
}

type GeoProvider = "photon" | "mapbox" | "google_maps";
type ConflictResolution = "lww" | "google_wins" | "delta_wins";

const GEO_PROVIDERS: { id: GeoProvider; label: string }[] = [
  { id: "photon", label: "photon" },
  { id: "mapbox", label: "mapbox" },
  { id: "google_maps", label: "google maps" },
];

const CONFLICT_STRATEGIES: { id: ConflictResolution; label: string }[] = [
  { id: "lww", label: "last write wins" },
  { id: "google_wins", label: "google wins" },
  { id: "delta_wins", label: "delta wins" },
];

type SyncInterval = 0 | 5 | 15 | 30;
const SYNC_INTERVALS: { id: SyncInterval; label: string }[] = [
  { id: 0, label: "manual only" },
  { id: 5, label: "5 minutes" },
  { id: 15, label: "15 minutes" },
  { id: 30, label: "30 minutes" },
];

const NLP_PROVIDERS_LIST: { id: "builtin" | NlpProvider; label: string }[] = [
  { id: "builtin", label: "built-in" },
  { id: "anthropic", label: "anthropic" },
  { id: "openai", label: "openai" },
];

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface MenuItem {
  id: string;
  label: string;
  muted?: boolean;
  prefix?: { text: string; className: string };
  suffix?: string;
  disabled?: boolean;
  onSelect: () => void;
}

export function CalendarActionsPopover({
  feedToken: initialFeedToken,
  gcalStatus: initialGcalStatus,
  initialGeoProvider = "photon",
  initialConflictResolution = "lww",
  syncInterval: currentSyncInterval = 5,
  onSyncIntervalChange,
  initialNlpProvider = null,
  initialNlpModel = "",
  open,
  onOpenChange,
}: {
  feedToken: string | null;
  gcalStatus: GcalStatus;
  initialGeoProvider?: GeoProvider;
  initialConflictResolution?: ConflictResolution;
  syncInterval?: number;
  onSyncIntervalChange?: (interval: number) => void;
  initialNlpProvider?: NlpProvider | null;
  initialNlpModel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const statusBar = useStatusBar();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [feedToken, setFeedToken] = useState(initialFeedToken);
  const [gcalStatus, setGcalStatus] = useState(initialGcalStatus);
  const [geoProvider, setGeoProvider] =
    useState<GeoProvider>(initialGeoProvider);
  const [geoKeyInput, setGeoKeyInput] = useState("");
  const [geoKeyTarget, setGeoKeyTarget] = useState<GeoProvider | null>(null);
  const [conflictResolution, setConflictResolution] =
    useState<ConflictResolution>(initialConflictResolution);
  const [nlpActive, setNlpActive] = useState<"builtin" | NlpProvider>(
    initialNlpProvider ?? "builtin",
  );
  const [nlpModel, setNlpModel] = useState(initialNlpModel);
  const [nlpKeyInput, setNlpKeyInput] = useState("");
  const [nlpKeyTarget, setNlpKeyTarget] = useState<NlpProvider | null>(null);
  const [geoKeyTesting, setGeoKeyTesting] = useState(false);
  const [nlpKeyTesting, setNlpKeyTesting] = useState(false);
  const [focusIdx, setFocusIdx] = useState(0);
  const countBuf = useRef("");
  const containerRef = useRef<HTMLDivElement>(null);

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/import/ical", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        statusBar.error(data.error ?? "import failed");
        return;
      }
      statusBar.message(
        `imported ${data.created} events, skipped ${data.skipped} duplicates`,
      );
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (e) {
      statusBar.error(e instanceof Error ? e.message : "import failed");
    } finally {
      setImporting(false);
    }
  }

  function handleExport() {
    window.location.href = "/api/export/ical";
  }

  function getFeedUrl(token: string): string {
    return `${window.location.origin}/api/calendar/feed/${token}`;
  }

  async function handleGenerateFeed() {
    const res = await fetch("/api/calendar/feed", { method: "POST" });
    const data = await res.json();
    setFeedToken(data.token);
    statusBar.message("feed url generated");
  }

  async function handleCopyFeedUrl() {
    if (!feedToken) return;
    await navigator.clipboard.writeText(getFeedUrl(feedToken));
    statusBar.message("copied to clipboard");
  }

  async function handleRevokeFeed() {
    await fetch("/api/calendar/feed", { method: "DELETE" });
    setFeedToken(null);
    statusBar.message("feed url revoked");
  }

  async function handleDisconnectGcal() {
    const res = await fetch("/api/settings/integrations/google_calendar", {
      method: "DELETE",
    });
    if (!res.ok) {
      statusBar.error("failed to disconnect");
      return;
    }
    setGcalStatus({ connected: false, lastSyncTime: null });
    statusBar.message("google calendar disconnected");
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
    onSyncIntervalChange?.(id);
    const label = SYNC_INTERVALS.find((s) => s.id === id)?.label ?? `${id}m`;
    statusBar.message(`sync interval set to ${label}`);
  }

  async function handleSelectNlpProvider(id: "builtin" | NlpProvider) {
    if (id === "builtin") {
      await fetch("/api/settings/nlp", { method: "DELETE" });
      setNlpActive("builtin");
      setNlpKeyTarget(null);
      setNlpModel("");
      statusBar.message("NLP set to built-in");
      return;
    }
    setNlpActive(id);
    setNlpModel(NLP_MODELS[id][0].id);
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
          model: nlpModel || undefined,
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
      body: JSON.stringify({
        llmProvider: provider,
        model: nlpModel,
        apiKey: nlpKeyInput.trim(),
      }),
    });
    if (!res.ok) {
      statusBar.error("failed to save nlp config");
      return;
    }
    setNlpKeyTarget(null);
    setNlpKeyInput("");
    statusBar.message(
      `NLP set to ${provider} ${NLP_MODELS[provider].find((m) => m.id === nlpModel)?.label ?? nlpModel}`,
    );
  }

  const items: MenuItem[] = [];

  if (gcalStatus.connected) {
    items.push({
      id: "gcal-disconnect",
      label: "disconnect",
      muted: true,
      prefix: { text: "-", className: "text-destructive" },
      onSelect: handleDisconnectGcal,
    });
  } else {
    items.push({
      id: "gcal-connect",
      label: "connect google calendar",
      muted: true,
      prefix: { text: "+", className: "text-status-done" },
      onSelect: () => {
        window.location.href = "/api/auth/google?scope=calendar";
      },
    });
  }

  if (gcalStatus.connected) {
    for (const s of CONFLICT_STRATEGIES) {
      items.push({
        id: `conflict-${s.id}`,
        label: s.label,
        muted: conflictResolution !== s.id,
        onSelect: () => handleSelectConflictResolution(s.id),
      });
    }
    for (const s of SYNC_INTERVALS) {
      items.push({
        id: `sync-interval-${s.id}`,
        label: s.label,
        muted: currentSyncInterval !== s.id,
        onSelect: () => handleSelectSyncInterval(s.id),
      });
    }
  }

  for (const p of GEO_PROVIDERS) {
    items.push({
      id: `geo-${p.id}`,
      label: p.label,
      muted: geoProvider !== p.id,
      onSelect: () => handleSelectGeoProvider(p.id),
    });
  }

  for (const p of NLP_PROVIDERS_LIST) {
    items.push({
      id: `nlp-${p.id}`,
      label: p.label,
      muted: nlpActive !== p.id,
      onSelect: () => handleSelectNlpProvider(p.id),
    });
  }

  if (feedToken) {
    items.push({
      id: "feed-copy",
      label: "copy feed url",
      onSelect: handleCopyFeedUrl,
    });
    items.push({
      id: "feed-revoke",
      label: "revoke feed",
      muted: true,
      prefix: { text: "-", className: "text-destructive" },
      onSelect: handleRevokeFeed,
    });
  } else {
    items.push({
      id: "feed-generate",
      label: "generate feed",
      muted: true,
      prefix: { text: "+", className: "text-status-done" },
      onSelect: handleGenerateFeed,
    });
  }

  items.push({
    id: "export",
    label: "export .ics",
    onSelect: handleExport,
  });
  items.push({
    id: "import",
    label: importing ? "importing..." : "import .ics",
    disabled: importing,
    onSelect: () => fileRef.current?.click(),
  });

  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (open) {
      setFocusIdx(0);
      countBuf.current = "";
      setGeoKeyTarget(null);
      setGeoKeyInput("");
      setNlpKeyTarget(null);
      setNlpKeyInput("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (geoKeyTarget || nlpKeyTarget) return;
      const cur = itemsRef.current;

      if (e.key >= "0" && e.key <= "9") {
        countBuf.current += e.key;
        e.preventDefault();
        return;
      }

      const count = Math.max(1, Number.parseInt(countBuf.current, 10) || 1);
      countBuf.current = "";

      if (e.key === "j") {
        e.preventDefault();
        setFocusIdx((prev) => Math.min(prev + count, cur.length - 1));
      } else if (e.key === "k") {
        e.preventDefault();
        setFocusIdx((prev) => Math.max(prev - count, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = cur[focusIdx];
        if (item && !item.disabled) item.onSelect();
      } else if (e.key === "Escape" || e.key === "q") {
        e.preventDefault();
        onOpenChange?.(false);
      } else if (e.key === "g") {
        setFocusIdx(0);
      } else if (e.key === "G") {
        setFocusIdx(cur.length - 1);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, focusIdx, geoKeyTarget, nlpKeyTarget, onOpenChange]);

  const gcalItems = items.filter((i) => i.id.startsWith("gcal-"));
  const conflictItems = items.filter((i) => i.id.startsWith("conflict-"));
  const syncIntervalItems = items.filter((i) =>
    i.id.startsWith("sync-interval-"),
  );
  const geoItems = items.filter((i) => i.id.startsWith("geo-"));
  const nlpItems = items.filter((i) => i.id.startsWith("nlp-"));
  const feedItems = items.filter((i) => i.id.startsWith("feed-"));
  const ioItems = items.filter((i) => i.id === "export" || i.id === "import");

  function globalIndex(sectionItems: MenuItem[], localIdx: number): number {
    const item = sectionItems[localIdx];
    return items.findIndex((i) => i.id === item.id);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger className="text-lg text-muted-foreground px-1 cursor-pointer hover:text-foreground leading-none">
        ≡
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <div ref={containerRef} className="flex flex-col">
          <div className="flex flex-col p-1">
            {gcalItems.map((item, i) => (
              <MenuRow
                key={item.id}
                item={item}
                focused={focusIdx === globalIndex(gcalItems, i)}
              />
            ))}
          </div>

          {conflictItems.length > 0 && (
            <>
              <div className="border-t border-border" />
              <div className="flex flex-col p-1">
                <div className="text-[10px] text-muted-foreground px-2 py-0.5">
                  sync strategy
                </div>
                {conflictItems.map((item, i) => (
                  <MenuRow
                    key={item.id}
                    item={item}
                    focused={focusIdx === globalIndex(conflictItems, i)}
                  />
                ))}
              </div>
            </>
          )}

          {syncIntervalItems.length > 0 && (
            <>
              <div className="border-t border-border" />
              <div className="flex flex-col p-1">
                <div className="text-[10px] text-muted-foreground px-2 py-0.5">
                  sync interval
                </div>
                {syncIntervalItems.map((item, i) => (
                  <MenuRow
                    key={item.id}
                    item={item}
                    focused={focusIdx === globalIndex(syncIntervalItems, i)}
                  />
                ))}
              </div>
            </>
          )}

          <div className="border-t border-border" />

          <div className="flex flex-col p-1">
            <div className="text-[10px] text-muted-foreground px-2 py-0.5">
              geocoding
            </div>
            {geoItems.map((item, i) => (
              <React.Fragment key={item.id}>
                <MenuRow
                  item={item}
                  focused={focusIdx === globalIndex(geoItems, i)}
                />
                {geoKeyTarget === item.id.replace("geo-", "") && (
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
                    <button
                      type="button"
                      disabled={geoKeyTesting || !geoKeyInput.trim()}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 disabled:opacity-50"
                      onClick={handleTestGeoKey}
                    >
                      {geoKeyTesting ? "..." : "test & save"}
                    </button>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="border-t border-border" />

          <div className="flex flex-col p-1">
            <div className="text-[10px] text-muted-foreground px-2 py-0.5">
              NLP
            </div>
            {nlpItems.map((item, i) => (
              <React.Fragment key={item.id}>
                <MenuRow
                  item={item}
                  focused={focusIdx === globalIndex(nlpItems, i)}
                />
                {nlpKeyTarget === item.id.replace("nlp-", "") && (
                  <div className="flex flex-col gap-1 px-2 py-1">
                    <div className="flex gap-1">
                      {NLP_MODELS[nlpKeyTarget as NlpProvider].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={`px-1.5 py-0.5 text-[10px] border border-border ${nlpModel === m.id ? "text-foreground bg-accent" : "text-muted-foreground"}`}
                          onClick={() => setNlpModel(m.id)}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
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
                      <button
                        type="button"
                        disabled={nlpKeyTesting || !nlpKeyInput.trim()}
                        className="text-xs text-muted-foreground hover:text-foreground px-2 disabled:opacity-50"
                        onClick={handleTestNlpKey}
                      >
                        {nlpKeyTesting ? "..." : "test & save"}
                      </button>
                    </div>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="border-t border-border" />

          <div className="flex flex-col p-1">
            <div className="text-[10px] text-muted-foreground px-2 py-0.5">
              CalDAV feed
            </div>
            {feedItems.map((item, i) => (
              <MenuRow
                key={item.id}
                item={item}
                focused={focusIdx === globalIndex(feedItems, i)}
              />
            ))}
          </div>

          <div className="border-t border-border" />

          <div className="flex flex-col p-1">
            <div className="text-[10px] text-muted-foreground px-2 py-0.5">
              import / export
            </div>
            {ioItems.map((item, i) => (
              <MenuRow
                key={item.id}
                item={item}
                focused={focusIdx === globalIndex(ioItems, i)}
              />
            ))}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".ics"
            className="hidden"
            onChange={() => handleImport()}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MenuRow({ item, focused }: { item: MenuItem; focused: boolean }) {
  return (
    <button
      type="button"
      disabled={item.disabled}
      onClick={item.onSelect}
      className={`flex items-center w-full text-xs h-7 px-2 cursor-pointer ${
        focused ? "bg-accent" : "hover:bg-accent/50"
      } ${item.disabled ? "opacity-50" : ""}`}
    >
      {item.prefix && (
        <span className={`${item.prefix.className} mr-1`}>
          {item.prefix.text}
        </span>
      )}
      <span
        className={item.muted ? "text-muted-foreground" : "text-foreground"}
      >
        {item.label}
      </span>
      {item.suffix && (
        <span className="ml-auto text-muted-foreground text-[10px]">
          {item.suffix}
        </span>
      )}
    </button>
  );
}
