"use client";

import { cn } from "@/lib/utils";

export function SettingsSection({
  title,
  description,
  headerAction,
  className,
  children,
  dividers = true,
}: {
  title: string;
  description?: string;
  headerAction?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  dividers?: boolean;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-4 px-0.5">
        <div className="space-y-1.5 min-w-0">
          <h2
            data-section={title}
            className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60"
          >
            {title}
          </h2>
          {description && (
            <p className="max-w-md text-xs text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>
      <div
        className={cn(
          "border-t border-b border-border/40",
          dividers && "divide-y divide-border/40",
        )}
      >
        {children}
      </div>
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
      className={cn(
        "flex w-full min-w-0 items-center gap-2 overflow-hidden",
        "px-3 py-2.5 text-sm transition-colors",
        action &&
          "cursor-pointer hover:bg-accent/40 focus-visible:bg-accent/40 outline-none",
      )}
      onClick={onClick}
      type={action ? "button" : undefined}
    >
      {prefix && (
        <span className={cn("mr-1 shrink-0 text-xs", prefix.className)}>
          {prefix.text}
        </span>
      )}
      <span
        className={cn(
          "flex-1 text-left truncate min-w-0",
          destructive
            ? "text-destructive"
            : muted
              ? "text-muted-foreground"
              : "text-foreground",
        )}
      >
        {label}
      </span>
      {value && (
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {value}
        </span>
      )}
    </Tag>
  );
}

export function SettingsPage({
  children,
  className,
  title,
  description,
}: {
  children?: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
}) {
  return (
    <div className={cn("w-full px-5 md:px-8 py-5 md:py-6", className)}>
      {(title || description) && (
        <header className="mb-6 pb-4 border-b border-border/60">
          {title && (
            <h1 className="text-lg leading-none text-foreground tracking-tight">
              {title}
            </h1>
          )}
          {description && (
            <p className="mt-2 max-w-xl text-xs text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
        </header>
      )}
      <div className="space-y-8">{children}</div>
    </div>
  );
}
