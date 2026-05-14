"use client";

import {
  ArrowSquareOut,
  CalendarDots,
  ListChecks,
  LockSimple,
} from "@phosphor-icons/react";
import type { TaskSourceInfo } from "@/core/types";
import { cn } from "@/lib/utils";

function shortProviderLabel(source: TaskSourceInfo): string {
  if (source.sourceKind === "google_calendar") return "gcal";
  if (source.sourceKind === "google_tasks_list") return "gtasks";
  if (source.provider === "ical") return "ics";
  return source.providerLabel.toLowerCase();
}

function sourceIcon(source: TaskSourceInfo) {
  if (source.sourceKind === "google_tasks_list") return ListChecks;
  return CalendarDots;
}

export function taskSourceTitle(source: TaskSourceInfo): string {
  const parts = [
    source.providerLabel,
    source.sourceKindLabel,
    source.sourceTitle,
    ...source.attributes,
  ].filter(Boolean);
  return parts.join(" / ");
}

export function isReadOnlyImportedTask(source: TaskSourceInfo | null): boolean {
  return Boolean(source?.readOnly);
}

export function readOnlyImportMessage(source: TaskSourceInfo | null): string {
  if (!source?.readOnly) return "";
  return `${source.providerLabel} imports are read-only`;
}

export function TaskSourceIndicator({
  source,
  className,
}: {
  source: TaskSourceInfo | null | undefined;
  className?: string;
}) {
  if (!source) return null;
  const Icon = sourceIcon(source);
  const attributes = source.attributes.filter(
    (attribute) => attribute !== "read-only",
  );

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] text-muted-foreground shrink-0",
        className,
      )}
      title={taskSourceTitle(source)}
    >
      {source.readOnly && (
        <LockSimple
          className="size-3 text-status-wip"
          aria-label="read-only import"
        />
      )}
      <Icon className="size-3" aria-hidden="true" />
      <span>{shortProviderLabel(source)}</span>
      {attributes.map((attribute) => (
        <span key={attribute}>[{attribute}]</span>
      ))}
    </span>
  );
}

export function TaskSourceDetails({
  source,
}: {
  source: TaskSourceInfo | null | undefined;
}) {
  if (!source) return null;

  return (
    <>
      <span className="text-xs text-muted-foreground/60">source</span>
      <div className="min-w-0 text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
        <TaskSourceIndicator source={source} />
        <span className="truncate">
          {[source.providerLabel, source.sourceTitle, source.sourceKindLabel]
            .filter(Boolean)
            .join(" / ")}
        </span>
      </div>
      {source.htmlLink && (
        <>
          <span className="text-xs text-muted-foreground/60">action</span>
          <a
            href={source.htmlLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-7 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            open in Google Calendar
            <ArrowSquareOut className="size-3" aria-hidden="true" />
          </a>
        </>
      )}
    </>
  );
}
