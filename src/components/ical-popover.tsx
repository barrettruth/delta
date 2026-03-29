"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useStatusBar } from "@/contexts/status-bar";

export function IcalPopover() {
  const statusBar = useStatusBar();
  const [category, setCategory] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      statusBar.error("select a .ics file first");
      return;
    }
    setImporting(true);
    try {
      const body = new FormData();
      body.append("file", file);
      if (category.trim()) body.append("category", category.trim());
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
      setCategory("");
    } catch (e) {
      statusBar.error(e instanceof Error ? e.message : "import failed");
    } finally {
      setImporting(false);
    }
  }

  function handleExport() {
    window.location.href = "/api/export/ical";
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="xs" className="text-muted-foreground" />
        }
      >
        ical
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="flex flex-col gap-3">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            export
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-7 text-xs w-full"
          >
            export .ics
          </Button>

          <div className="h-px bg-border" />

          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            import
          </div>
          <Input
            ref={fileRef}
            type="file"
            accept=".ics"
            className="h-8 text-sm"
          />
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="category (optional)"
            className="h-7 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleImport();
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleImport}
            disabled={importing}
            className="h-7 text-xs w-full"
          >
            {importing ? "importing..." : "import .ics"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
