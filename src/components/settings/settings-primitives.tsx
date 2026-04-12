"use client";

import { cn } from "@/lib/utils";

export function SettingsSection({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <div className="px-1">
        <h2
          data-section={title}
          className="text-xs text-muted-foreground/60 uppercase tracking-wider"
        >
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="border-y border-border/50">{children}</div>
    </section>
  );
}

export function SettingsRow({
  label,
  value,
  action,
  muted,
  destructive,
  prefix,
  onClick,
}: {
  label: string;
  value?: string;
  action?: boolean;
  muted?: boolean;
  destructive?: boolean;
  prefix?: { text: string; className: string };
  onClick?: () => void;
}) {
  const Tag = action ? "button" : "div";
  return (
    <Tag
      className={`flex w-full min-w-0 items-center gap-2 overflow-hidden border-b border-border/40 px-3 py-2.5 text-sm transition-colors last:border-b-0 ${action ? "cursor-pointer hover:bg-accent/30" : ""}`}
      onClick={onClick}
      type={action ? "button" : undefined}
    >
      {prefix && (
        <span className={`${prefix.className} mr-1 shrink-0`}>
          {prefix.text}
        </span>
      )}
      <span
        className={`flex-1 text-left truncate min-w-0 ${
          destructive
            ? "text-destructive"
            : muted
              ? "text-muted-foreground"
              : "text-foreground"
        }`}
      >
        {label}
      </span>
      {value && <span className="text-muted-foreground shrink-0">{value}</span>}
    </Tag>
  );
}

export function SettingsPage({
  children,
  className = "max-w-3xl",
  title,
  description,
}: {
  children?: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
}) {
  return (
    <div className={cn("w-full px-4 py-6 md:px-6 md:py-8", className)}>
      {(title || description) && (
        <header className="mb-6 md:mb-8">
          {title && (
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          )}
          {description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </header>
      )}
      <div className="space-y-6">{children}</div>
    </div>
  );
}
