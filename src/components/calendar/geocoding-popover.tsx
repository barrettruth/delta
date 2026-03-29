"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useStatusBar } from "@/contexts/status-bar";

type GeoProvider = "photon" | "mapbox";

interface IntegrationSummary {
  provider: string;
  enabled: number;
  metadata: Record<string, unknown> | null;
}

export function GeocodingPopover() {
  const statusBar = useStatusBar();
  const [active, setActive] = useState<GeoProvider>("photon");
  const [mapboxConfigured, setMapboxConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const fetchStatus = useCallback(async () => {
    const res = await fetch("/api/settings/integrations");
    const configs: IntegrationSummary[] = await res.json();
    const mapbox = configs.find((c) => c.provider === "mapbox");
    if (mapbox) {
      setMapboxConfigured(true);
      setActive("mapbox");
    } else {
      setMapboxConfigured(false);
      setActive("photon");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function selectPhoton() {
    if (mapboxConfigured) {
      await fetch("/api/settings/integrations/mapbox", { method: "DELETE" });
      setMapboxConfigured(false);
      statusBar.message("Mapbox disconnected");
    }
    setActive("photon");
    setPopoverOpen(false);
  }

  function selectMapbox() {
    if (mapboxConfigured && !editMode) {
      setActive("mapbox");
      setPopoverOpen(false);
      return;
    }
    setEditMode(false);
    setApiKey("");
    setDialogOpen(true);
    setPopoverOpen(false);
  }

  function handleEditKey() {
    setEditMode(true);
    setApiKey("");
    setDialogOpen(true);
    setPopoverOpen(false);
  }

  async function handleSaveKey() {
    if (!apiKey.trim()) return;
    setSaving(true);
    const res = await fetch("/api/settings/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "mapbox",
        tokens: { api_key: apiKey.trim() },
      }),
    });
    setSaving(false);
    if (!res.ok) {
      statusBar.error("failed to save api key");
      return;
    }
    setMapboxConfigured(true);
    setActive("mapbox");
    setDialogOpen(false);
    setApiKey("");
    statusBar.message("Mapbox connected");
  }

  if (loading) return null;

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="xs"
              className="text-xs text-muted-foreground"
            />
          }
        >
          location
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-2">
          <div className="flex flex-col">
            <button
              type="button"
              onClick={selectPhoton}
              className="flex items-center justify-between w-full px-2 py-1.5 text-left text-xs hover:bg-muted/50 transition-colors"
            >
              <span className={active === "photon" ? "font-bold" : ""}>
                photon
              </span>
              {active === "photon" && (
                <span className="text-muted-foreground">&#10003;</span>
              )}
            </button>
            <button
              type="button"
              onClick={selectMapbox}
              className="flex items-center justify-between w-full px-2 py-1.5 text-left text-xs hover:bg-muted/50 transition-colors"
            >
              <span className={active === "mapbox" ? "font-bold" : ""}>
                mapbox
              </span>
              {active === "mapbox" && (
                <span className="text-muted-foreground">&#10003;</span>
              )}
            </button>
            {active === "mapbox" && mapboxConfigured && (
              <>
                <div className="h-px bg-border my-1" />
                <button
                  type="button"
                  onClick={handleEditKey}
                  className="w-full px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  edit key
                </button>
              </>
            )}
            <div className="h-px bg-border my-1" />
            <div className="px-2 py-1 text-[11px] text-muted-foreground leading-snug">
              photon is free, OpenStreetMap-based. mapbox has better POI
              coverage but requires an API key.
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>mapbox API key</DialogTitle>
          </DialogHeader>
          <Input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="pk.eyJ1..."
            className="text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveKey();
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                setDialogOpen(false);
                setApiKey("");
              }}
            >
              cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={handleSaveKey}
              disabled={saving || !apiKey.trim()}
            >
              {saving ? "saving..." : "save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
