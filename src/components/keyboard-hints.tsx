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
    <span>
      <Kbd>{keys}</Kbd> {label}
    </span>
  );
}

export function KeyboardHints() {
  const pathname = usePathname();
  const isList = pathname === "/" || pathname === "/queue";

  return (
    <div className="flex items-center gap-4 px-4 h-8 border-t border-border/60 text-xs text-muted-foreground shrink-0 select-none">
      {isList && (
        <>
          <Hint keys="j/k" label="navigate" />
          <Hint keys="x" label="complete" />
          <Hint keys="d" label="delete" />
          <Hint keys="o" label="new" />
          <Hint keys="/" label="search" />
          <Hint keys="Enter" label="open" />
        </>
      )}
      <div className="flex-1" />
      <Hint keys="1-4" label="views" />
      <Hint keys="b" label="sidebar" />
      <Hint keys="q" label="logout" />
    </div>
  );
}
