"use client";

import { usePathname } from "next/navigation";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60 font-mono text-[10px]">
      {children}
    </kbd>
  );
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Kbd>{keys}</Kbd>
      <span>{label}</span>
    </span>
  );
}

export function KeyboardHints() {
  const pathname = usePathname();
  const isList = pathname === "/";
  const isCalendar = pathname === "/calendar";

  return (
    <div className="flex items-center gap-4 px-4 h-8 border-t border-border/60 text-xs text-muted-foreground/70 shrink-0 select-none">
      {isList && (
        <>
          <Hint keys="j/k" label="navigate" />
          <Hint keys="x" label="complete" />
          <Hint keys="d" label="delete" />
          <Hint keys="o" label="new" />
          <Hint keys="Enter" label="open" />
        </>
      )}
      {isCalendar && (
        <>
          <Hint keys="w/m" label="switch view" />
          <Hint keys="[w/]w" label="prev/next week" />
          <Hint keys="[m/]m" label="prev/next month" />
          <Hint keys="t" label="today" />
        </>
      )}
      <div className="flex-1" />
      <Hint keys="QKCS" label="views" />
      <Hint keys="b" label="sidebar" />
      <Hint keys="q" label="logout" />
    </div>
  );
}
