"use client";

export function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pb-6 mb-6">
      <h2
        data-section={title}
        className="text-xs text-muted-foreground/60 uppercase tracking-wider mb-3"
      >
        {title}
      </h2>
      {children}
    </div>
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
      className={`flex items-center w-full text-sm py-2 md:py-1 px-2 overflow-hidden min-w-0 ${action ? "hover:bg-accent/50 cursor-pointer" : ""}`}
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

export function SettingsPage({ children }: { children: React.ReactNode }) {
  return <div className="w-full max-w-md px-6 py-6">{children}</div>;
}
