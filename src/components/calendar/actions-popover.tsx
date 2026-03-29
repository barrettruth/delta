"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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

export function CalendarActionsPopover({
  feedToken: initialFeedToken,
  gcalStatus: initialGcalStatus,
}: {
  feedToken: string | null;
  gcalStatus: GcalStatus;
}) {
  const statusBar = useStatusBar();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [feedToken, setFeedToken] = useState(initialFeedToken);
  const [gcalStatus, setGcalStatus] = useState(initialGcalStatus);

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

  async function handleRevokeFeed() {
    await fetch("/api/calendar/feed", { method: "DELETE" });
    setFeedToken(null);
    statusBar.message("feed url revoked");
  }

  async function handleCopyFeedUrl() {
    if (!feedToken) return;
    await navigator.clipboard.writeText(getFeedUrl(feedToken));
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

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="text-xs text-muted-foreground"
          />
        }
      >
        actions
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <div className="flex flex-col">
          <div className="flex flex-col gap-0.5 p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              className="h-7 text-xs w-full justify-start"
            >
              export .ics
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs w-full justify-start"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              {importing ? "importing..." : "import .ics"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".ics"
              className="hidden"
              onChange={() => handleImport()}
            />
          </div>

          <div className="border-t border-border" />

          <div className="flex flex-col gap-0.5 p-2">
            {feedToken ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyFeedUrl}
                  className="h-7 text-xs w-full justify-start"
                >
                  copy feed url
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRevokeFeed}
                  className="h-7 text-xs w-full justify-start text-muted-foreground"
                >
                  <span className="text-destructive">-</span> revoke
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerateFeed}
                className="h-7 text-xs w-full justify-start text-muted-foreground"
              >
                <span className="text-status-done">+</span> generate feed url
              </Button>
            )}
          </div>

          <div className="border-t border-border" />

          <div className="flex flex-col gap-0.5 p-2">
            {gcalStatus.connected ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnectGcal}
                  className="h-7 text-xs w-full justify-start text-muted-foreground"
                >
                  <span className="text-destructive">-</span> disconnect
                </Button>
                {gcalStatus.lastSyncTime && (
                  <div className="h-7 text-xs w-full flex items-center px-2 text-muted-foreground">
                    synced {formatRelativeTime(gcalStatus.lastSyncTime)}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                  className="h-7 text-xs w-full justify-start"
                >
                  {syncing ? "syncing..." : "sync now"}
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  window.location.href =
                    "/api/auth/google?scope=calendar.events";
                }}
                className="h-7 text-xs w-full justify-start text-muted-foreground"
              >
                <span className="text-status-done">+</span> connect google
                calendar
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
