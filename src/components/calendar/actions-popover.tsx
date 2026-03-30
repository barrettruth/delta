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
  open,
  onOpenChange,
}: {
  feedToken: string | null;
  gcalStatus: GcalStatus;
  initialGeoProvider?: GeoProvider;
  initialConflictResolution?: ConflictResolution;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const statusBar = useStatusBar();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [feedToken, setFeedToken] = useState(initialFeedToken);
  const [gcalStatus, setGcalStatus] = useState(initialGcalStatus);
  const [geoProvider, setGeoProvider] =
    useState<GeoProvider>(initialGeoProvider);
  const [geoKeyInput, setGeoKeyInput] = useState("");
  const [geoKeyTarget, setGeoKeyTarget] = useState<GeoProvider | null>(null);
  const [conflictResolution, setConflictResolution] =
    useState<ConflictResolution>(initialConflictResolution);
  const [feedCopied, setFeedCopied] = useState(false);
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
    await navigator.clipboard.writeText(getFeedUrl(data.token));
    setFeedCopied(true);
    statusBar.message("feed url generated and copied");
  }

  async function handleRevokeFeed() {
    await fetch("/api/calendar/feed", { method: "DELETE" });
    setFeedToken(null);
    setFeedCopied(false);
    statusBar.message("feed url revoked");
  }

  async function handleCopyFeedUrl() {
    if (!feedToken) return;
    await navigator.clipboard.writeText(getFeedUrl(feedToken));
    setFeedCopied(true);
    statusBar.message("copied to clipboard");
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

  async function handleSync() {
    setSyncing(true);
    statusBar.setOperation("syncing...");
    try {
      const res = await fetch("/api/calendar/sync", { method: "POST" });
      const data = await res.json();
      statusBar.clearOperation();
      if (!res.ok) {
        statusBar.error(data.error ?? "sync failed");
        return;
      }
      const total = data.pulled + data.pushed;
      statusBar.message(`synced ${total} events`);
      setGcalStatus({
        connected: true,
        lastSyncTime: new Date().toISOString(),
      });
      router.refresh();
    } catch (e) {
      statusBar.clearOperation();
      statusBar.error(e instanceof Error ? e.message : "sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSelectGeoProvider(id: GeoProvider) {
    if (id === "photon") {
      for (const p of ["mapbox", "google_maps"]) {
        await fetch(`/api/settings/integrations/${p}`, { method: "DELETE" });
      }
      setGeoProvider("photon");
      setGeoKeyTarget(null);
      statusBar.message("location api set to photon");
      return;
    }
    setGeoKeyTarget(id);
    setGeoKeyInput("");
    setGeoProvider(id);
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
    statusBar.message(`location api set to ${label}`);
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

  const items: MenuItem[] = [];

  if (gcalStatus.connected) {
    items.push({
      id: "gcal-disconnect",
      label: "disconnect",
      muted: true,
      prefix: { text: "-", className: "text-destructive" },
      onSelect: handleDisconnectGcal,
    });
    items.push({
      id: "gcal-sync",
      label: syncing ? "syncing..." : "sync now",
      disabled: syncing,
      suffix: gcalStatus.lastSyncTime
        ? formatRelativeTime(gcalStatus.lastSyncTime)
        : undefined,
      onSelect: handleSync,
    });
  } else {
    items.push({
      id: "gcal-connect",
      label: "connect google calendar",
      muted: true,
      prefix: { text: "+", className: "text-status-done" },
      onSelect: () => {
        window.location.href = "/api/auth/google?scope=calendar.events";
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
  }

  for (const p of GEO_PROVIDERS) {
    items.push({
      id: `geo-${p.id}`,
      label: p.label,
      muted: geoProvider !== p.id,
      onSelect: () => handleSelectGeoProvider(p.id),
    });
  }

  if (feedToken) {
    if (feedCopied) {
      items.push({
        id: "feed-toggle",
        label: "revoke feed",
        muted: true,
        prefix: { text: "-", className: "text-destructive" },
        onSelect: handleRevokeFeed,
      });
    } else {
      items.push({
        id: "feed-toggle",
        label: "copy feed",
        prefix: { text: "+", className: "text-status-done" },
        onSelect: handleCopyFeedUrl,
      });
    }
  } else {
    items.push({
      id: "feed-toggle",
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
      setFeedCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (geoKeyTarget) return;
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
  }, [open, focusIdx, geoKeyTarget, onOpenChange]);

  const gcalItems = items.filter((i) => i.id.startsWith("gcal-"));
  const conflictItems = items.filter((i) => i.id.startsWith("conflict-"));
  const geoItems = items.filter((i) => i.id.startsWith("geo-"));
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

          <div className="border-t border-border" />

          <div className="flex flex-col p-1">
            <div className="text-[10px] text-muted-foreground px-2 py-0.5">
              location API
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
                        if (e.key === "Enter") handleSaveGeoKey();
                        if (e.key === "Escape") {
                          setGeoKeyTarget(null);
                          setGeoKeyInput("");
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground px-2"
                      onClick={handleSaveGeoKey}
                    >
                      save
                    </button>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="border-t border-border" />

          <div className="flex flex-col p-1">
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
