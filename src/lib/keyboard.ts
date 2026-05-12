export type KeyboardEventLike = Pick<
  KeyboardEvent,
  "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

export type KeyboardScope =
  | "dialog"
  | "global"
  | "popover"
  | "task-panel"
  | "view";

export interface KeyboardScopeDocument {
  activeElement: Element | null;
  querySelector(selectors: string): Element | null;
}

export interface KeyboardScopeOptions {
  scope: KeyboardScope;
  document?: KeyboardScopeDocument | null;
  dialogOpen?: boolean;
  taskPanelOpen?: boolean;
  popoverOpen?: boolean;
  ignoreBrowserShortcuts?: boolean;
  ignoreInputFocus?: boolean;
  ignoreModifierOnly?: boolean;
}

type KeyboardScopeOptionsInput =
  | KeyboardScopeOptions
  | (() => KeyboardScopeOptions);

interface KeyboardListenerTarget<TEvent extends KeyboardEventLike> {
  addEventListener(
    type: "keydown",
    listener: (event: TEvent) => void,
    options?: AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: "keydown",
    listener: (event: TEvent) => void,
    options?: EventListenerOptions,
  ): void;
}

const MODIFIER_ONLY_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

const BROWSER_CTRL_KEYS = new Set([
  "-",
  "=",
  "+",
  "0",
  "t",
  "w",
  "n",
  "l",
  "r",
  "f",
  "p",
  "Tab",
]);

const BROWSER_CTRL_SHIFT_KEYS = new Set(["I", "R", "Tab", "J", "T", "N"]);

function currentDocument(): KeyboardScopeDocument | null {
  return typeof document === "undefined" ? null : document;
}

function resolveScopeOptions(
  options: KeyboardScopeOptionsInput,
): KeyboardScopeOptions {
  return typeof options === "function" ? options() : options;
}

export function isModifierOnlyKey(key: string): boolean {
  return MODIFIER_ONLY_KEYS.has(key);
}

export function isEditableElement(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName.toUpperCase();
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    (element as HTMLElement).isContentEditable === true
  );
}

export function isInputFocused(
  keyboardDocument: KeyboardScopeDocument | null = currentDocument(),
): boolean {
  return isEditableElement(keyboardDocument?.activeElement ?? null);
}

export function hasOpenDialog(
  keyboardDocument: KeyboardScopeDocument | null = currentDocument(),
): boolean {
  return keyboardDocument?.querySelector("[role=dialog]") != null;
}

export function isBrowserShortcut(event: KeyboardEventLike): boolean {
  if (event.altKey && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
    return true;
  }
  if (event.key === "F5" || event.key === "F11" || event.key === "F12") {
    return true;
  }
  if (!event.ctrlKey && !event.metaKey) return false;
  if (event.shiftKey && BROWSER_CTRL_SHIFT_KEYS.has(event.key)) return true;
  return BROWSER_CTRL_KEYS.has(event.key);
}

export function shouldHandleKeyboardEvent(
  event: KeyboardEventLike,
  options: KeyboardScopeOptions,
): boolean {
  const keyboardDocument = options.document ?? currentDocument();

  if (options.ignoreBrowserShortcuts !== false && isBrowserShortcut(event)) {
    return false;
  }

  if (options.ignoreModifierOnly !== false && isModifierOnlyKey(event.key)) {
    return false;
  }

  if (options.ignoreInputFocus !== false && isInputFocused(keyboardDocument)) {
    return false;
  }

  const dialogOpen = options.dialogOpen ?? hasOpenDialog(keyboardDocument);
  const taskPanelOpen = options.taskPanelOpen ?? false;
  const popoverOpen = options.popoverOpen ?? false;

  if (options.scope === "global" || options.scope === "view") {
    return !dialogOpen && !taskPanelOpen && !popoverOpen;
  }

  if (options.scope === "task-panel") {
    return !dialogOpen && !popoverOpen;
  }

  return true;
}

export function handleScopedKeyboardEvent<TEvent extends KeyboardEventLike>(
  event: TEvent,
  options: KeyboardScopeOptionsInput,
  handler: (event: TEvent) => void,
): boolean {
  if (!shouldHandleKeyboardEvent(event, resolveScopeOptions(options))) {
    return false;
  }
  handler(event);
  return true;
}

export function registerScopedKeydown<TEvent extends KeyboardEventLike>(
  target: KeyboardListenerTarget<TEvent>,
  options: KeyboardScopeOptionsInput,
  handler: (event: TEvent) => void,
  eventOptions?: AddEventListenerOptions,
): () => void {
  const listener = (event: TEvent) => {
    handleScopedKeyboardEvent(event, options, handler);
  };

  target.addEventListener("keydown", listener, eventOptions);
  return () => target.removeEventListener("keydown", listener, eventOptions);
}
