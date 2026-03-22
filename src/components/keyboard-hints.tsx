export function KeyboardHints() {
  return (
    <div className="flex items-center gap-4 px-4 h-8 border-t border-border/60 text-xs text-muted-foreground shrink-0 select-none">
      <span>
        <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60 font-mono text-[10px]">
          j
        </kbd>
        /
        <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60 font-mono text-[10px]">
          k
        </kbd>{" "}
        navigate
      </span>
      <span>
        <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60 font-mono text-[10px]">
          x
        </kbd>{" "}
        complete
      </span>
      <span>
        <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60 font-mono text-[10px]">
          d
        </kbd>{" "}
        delete
      </span>
      <span>
        <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60 font-mono text-[10px]">
          o
        </kbd>{" "}
        new
      </span>
      <span>
        <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60 font-mono text-[10px]">
          Enter
        </kbd>{" "}
        open
      </span>
      <span>
        <kbd className="px-1 py-0.5 rounded bg-muted border border-border/60 font-mono text-[10px]">
          Esc
        </kbd>{" "}
        close
      </span>
    </div>
  );
}
