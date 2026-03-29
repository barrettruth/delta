"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function CalendarFeedPopover() {
  const [feedToken, setFeedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchStatus = useCallback(async () => {
    const res = await fetch("/api/calendar/feed");
    const data = await res.json();
    setFeedToken(data.token);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  function getFeedUrl(token: string): string {
    return `${window.location.origin}/api/calendar/feed/${token}`;
  }

  async function handleGenerate() {
    const res = await fetch("/api/calendar/feed", { method: "POST" });
    const data = await res.json();
    setFeedToken(data.token);
  }

  async function handleRevoke() {
    await fetch("/api/calendar/feed", { method: "DELETE" });
    setFeedToken(null);
    setCopied(false);
  }

  async function handleCopy() {
    if (!feedToken) return;
    await navigator.clipboard.writeText(getFeedUrl(feedToken));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return null;

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
        feed
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        {feedToken ? (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="w-full text-left text-[11px] text-muted-foreground break-all select-all px-2 py-1.5 border border-border font-mono hover:bg-muted/50 cursor-pointer transition-colors"
            >
              {copied ? "copied" : getFeedUrl(feedToken)}
            </button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="xs"
                className="flex-1 text-xs text-muted-foreground"
                onClick={handleGenerate}
              >
                regenerate
              </Button>
              <Button
                variant="ghost"
                size="xs"
                className="flex-1 text-xs text-muted-foreground"
                onClick={handleRevoke}
              >
                revoke
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="xs"
            className="w-full text-xs text-muted-foreground"
            onClick={handleGenerate}
          >
            enable calendar feed
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
