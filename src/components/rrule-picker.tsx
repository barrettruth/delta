"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildRRule,
  rruleToText,
  type BuildRRuleOpts,
  type RRuleFrequency,
} from "@/core/recurrence";
import type { RecurMode } from "@/core/types";

const PRESETS: { value: RRuleFrequency | "none" | "custom"; label: string }[] = [
  { value: "none", label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "weekdays", label: "Weekdays" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom..." },
];

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function RRulePicker({
  value,
  recurMode,
  onChange,
  onRecurModeChange,
}: {
  value: string | null;
  recurMode: RecurMode | null;
  onChange: (rrule: string | null) => void;
  onRecurModeChange: (mode: RecurMode) => void;
}) {
  const [preset, setPreset] = useState<RRuleFrequency | "none" | "custom">("none");
  const [interval, setInterval] = useState(1);
  const [customFreq, setCustomFreq] = useState<Exclude<RRuleFrequency, "weekdays">>("weekly");
  const [byweekday, setByweekday] = useState<number[]>([]);
  const [bymonthday, setBymonthdayStr] = useState("");

  useEffect(() => {
    if (!value) {
      setPreset("none");
      return;
    }
    const upper = value.toUpperCase();
    if (upper.includes("FREQ=DAILY") && !upper.includes("INTERVAL=")) {
      setPreset("daily");
    } else if (upper.includes("FREQ=WEEKLY") && upper.includes("BYDAY=MO,TU,WE,TH,FR")) {
      setPreset("weekdays");
    } else if (upper.includes("FREQ=WEEKLY") && !upper.includes("INTERVAL=") && !upper.includes("BYDAY=")) {
      setPreset("weekly");
    } else if (upper.includes("FREQ=MONTHLY") && !upper.includes("INTERVAL=")) {
      setPreset("monthly");
    } else if (upper.includes("FREQ=YEARLY") && !upper.includes("INTERVAL=")) {
      setPreset("yearly");
    } else {
      setPreset("custom");
    }
  }, [value]);

  const humanText = useMemo(() => {
    if (!value) return null;
    try {
      return rruleToText(value);
    } catch {
      return null;
    }
  }, [value]);

  function handlePresetChange(p: string | null) {
    if (!p) return;
    const v = p as RRuleFrequency | "none" | "custom";
    setPreset(v);
    if (v === "none") {
      onChange(null);
      return;
    }
    if (v === "custom") return;
    onChange(buildRRule({ freq: v }));
  }

  function handleCustomUpdate(opts: Partial<BuildRRuleOpts>) {
    const freq = opts.freq ?? customFreq;
    if (opts.freq && opts.freq !== "weekdays") setCustomFreq(opts.freq as Exclude<RRuleFrequency, "weekdays">);

    const bmd = opts.bymonthday ?? (bymonthday ? bymonthday.split(",").map(Number).filter(Boolean) : undefined);

    const rrule = buildRRule({
      freq,
      interval: opts.interval ?? interval,
      byweekday: opts.byweekday ?? (freq === "weekly" ? byweekday : undefined),
      bymonthday: bmd?.length ? bmd : undefined,
    });
    onChange(rrule);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select value={preset} onValueChange={handlePresetChange}>
          <SelectTrigger className="h-7 text-xs flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value && (
          <Select
            value={recurMode ?? "scheduled"}
            onValueChange={(v) => onRecurModeChange(v as RecurMode)}
          >
            <SelectTrigger className="h-7 text-xs w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">scheduled</SelectItem>
              <SelectItem value="completion">on completion</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {preset === "custom" && (
        <div className="space-y-2 pl-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">every</span>
            <Input
              type="number"
              min={1}
              max={99}
              value={interval}
              onChange={(e) => {
                const n = Math.max(1, Number.parseInt(e.target.value, 10) || 1);
                setInterval(n);
                handleCustomUpdate({ interval: n });
              }}
              className="h-7 text-xs w-14"
            />
            <Select
              value={customFreq}
              onValueChange={(v) => {
                const f = v as Exclude<RRuleFrequency, "weekdays">;
                setCustomFreq(f);
                handleCustomUpdate({ freq: f });
              }}
            >
              <SelectTrigger className="h-7 text-xs w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{interval > 1 ? "days" : "day"}</SelectItem>
                <SelectItem value="weekly">{interval > 1 ? "weeks" : "week"}</SelectItem>
                <SelectItem value="monthly">{interval > 1 ? "months" : "month"}</SelectItem>
                <SelectItem value="yearly">{interval > 1 ? "years" : "year"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {customFreq === "weekly" && (
            <div className="flex gap-1">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={`day-${label}-${i}`}
                  type="button"
                  className={`w-7 h-7 text-xs border transition-colors ${
                    byweekday.includes(i)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-accent"
                  }`}
                  onClick={() => {
                    const next = byweekday.includes(i)
                      ? byweekday.filter((d) => d !== i)
                      : [...byweekday, i];
                    setByweekday(next);
                    handleCustomUpdate({ byweekday: next });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {customFreq === "monthly" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">on days</span>
              <Input
                value={bymonthday}
                onChange={(e) => {
                  setBymonthdayStr(e.target.value);
                  const days = e.target.value.split(",").map(Number).filter(Boolean);
                  if (days.length) handleCustomUpdate({ bymonthday: days });
                }}
                placeholder="1, 15"
                className="h-7 text-xs w-24"
              />
            </div>
          )}
        </div>
      )}

      {humanText && (
        <p className="text-[10px] text-muted-foreground/60 pl-1">{humanText}</p>
      )}
    </div>
  );
}
