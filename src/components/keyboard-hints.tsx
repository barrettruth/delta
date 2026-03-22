export function KeyboardHints() {
  return (
    <div className="flex items-center gap-4 px-4 h-8 border-t text-xs text-muted-foreground shrink-0">
      <span>
        <kbd className="px-1 rounded bg-muted font-mono">j</kbd>/
        <kbd className="px-1 rounded bg-muted font-mono">k</kbd> navigate
      </span>
      <span>
        <kbd className="px-1 rounded bg-muted font-mono">x</kbd> complete
      </span>
      <span>
        <kbd className="px-1 rounded bg-muted font-mono">d</kbd> delete
      </span>
      <span>
        <kbd className="px-1 rounded bg-muted font-mono">o</kbd> new
      </span>
      <span>
        <kbd className="px-1 rounded bg-muted font-mono">Enter</kbd> open
      </span>
      <span>
        <kbd className="px-1 rounded bg-muted font-mono">Esc</kbd> close
      </span>
    </div>
  );
}
