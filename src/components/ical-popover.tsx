"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useStatusBar } from "@/contexts/status-bar";

export function IcalPopover() {
  const statusBar = useStatusBar();
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
        import/export
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
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs w-full"
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
      </PopoverContent>
    </Popover>
  );
}
