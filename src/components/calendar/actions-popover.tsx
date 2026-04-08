"use client";

import { ArrowsClockwise, CalendarDots } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useStatusBar } from "@/contexts/status-bar";

interface MenuItem {
  id: string;
  label: string;
  muted?: boolean;
  prefix?: { text: string; className: string };
  icon?: React.ReactNode;
  disabled?: boolean;
  onSelect: () => void;
}

export function CalendarActionsPopover({
  feedToken: initialFeedToken,
  gcalConnected = false,
  open,
  onOpenChange,
}: {
  feedToken: string | null;
  gcalConnected?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const statusBar = useStatusBar();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [feedToken, setFeedToken] = useState(initialFeedToken);
  const [focusIdx, setFocusIdx] = useState(0);
  const countBuf = useRef("");

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

  async function handleSyncNow() {
    statusBar.setOperation("syncing...");
    try {
      const res = await fetch("/api/calendar/sync", { method: "POST" });
      statusBar.clearOperation();
      if (!res.ok) {
        statusBar.error("sync failed");
        return;
      }
      const data = await res.json();
      const total = (data.pulled ?? 0) + (data.pushed ?? 0);
      if (total > 0) statusBar.message(`synced ${total} events`);
      else statusBar.message("already up to date");
      router.refresh();
    } catch {
      statusBar.clearOperation();
      statusBar.error("sync failed");
    }
  }

  const items: MenuItem[] = [];

  if (gcalConnected) {
    items.push({
      id: "gcal-sync",
      label: "sync now",
      icon: <ArrowsClockwise size={12} />,
      onSelect: handleSyncNow,
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

  items.push({
    id: "settings",
    label: "calendar settings",
    muted: true,
    onSelect: () => router.push("/settings/calendar"),
  });

  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (open) {
      setFocusIdx(0);
      countBuf.current = "";
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
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
  }, [open, focusIdx, onOpenChange]);

  const syncItem = items.find((i) => i.id === "gcal-sync");
  const feedItems = items.filter((i) => i.id.startsWith("feed-"));
  const ioItems = items.filter((i) => i.id === "export" || i.id === "import");
  const settingsItem = items.find((i) => i.id === "settings");

  function globalIndex(sectionItems: MenuItem[], localIdx: number): number {
    const item = sectionItems[localIdx];
    return items.findIndex((i) => i.id === item.id);
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label="calendar actions"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-hidden transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CalendarDots size={16} weight="bold" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <div className="flex flex-col">
          {syncItem && (
            <>
              <div className="flex flex-col p-1">
                <MenuRow
                  item={syncItem}
                  focused={focusIdx === items.indexOf(syncItem)}
                />
              </div>
              <div className="border-t border-border" />
            </>
          )}
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

          <div className="border-t border-border" />

          <div className="flex flex-col p-1">
            <div className="text-[10px] text-muted-foreground px-2 py-0.5">
              settings
            </div>
            {settingsItem && (
              <MenuRow
                item={settingsItem}
                focused={focusIdx === items.indexOf(settingsItem)}
              />
            )}
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
      {item.icon && (
        <span className="text-muted-foreground mr-1.5">{item.icon}</span>
      )}
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
    </button>
  );
}
