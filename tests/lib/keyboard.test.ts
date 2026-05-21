import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveCalendarPendingLeaderAction } from "@/components/calendar/use-calendar-keyboard";
import { resolveQueuePendingLeaderAction } from "@/hooks/use-keyboard";
import { consumeEarlyKeyboardEvents } from "@/lib/early-keyboard";
import {
  hasOpenDialog,
  isBrowserShortcut,
  isEditableElement,
  isInputFocused,
  isModifierOnlyKey,
  type KeyboardEventLike,
  type KeyboardScopeDocument,
  registerScopedKeydown,
  shouldHandleKeyboardEvent,
} from "@/lib/keyboard";

function keyEvent(
  overrides: Partial<KeyboardEventLike> = {},
): KeyboardEventLike {
  return {
    key: "",
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...overrides,
  };
}

function element(tagName: string, isContentEditable = false): Element {
  return { tagName, isContentEditable } as HTMLElement;
}

function keyboardDocument({
  activeElement = null,
  dialogOpen = false,
}: {
  activeElement?: Element | null;
  dialogOpen?: boolean;
} = {}): KeyboardScopeDocument {
  return {
    activeElement,
    querySelector: (selector) =>
      selector === "[role=dialog]" && dialogOpen ? element("div") : null,
  };
}

class KeyboardTarget {
  private listeners = new Set<(event: KeyboardEventLike) => void>();
  lastAddOptions: AddEventListenerOptions | undefined;
  lastRemoveOptions: EventListenerOptions | undefined;

  addEventListener(
    type: "keydown",
    listener: (event: KeyboardEventLike) => void,
    options?: AddEventListenerOptions,
  ) {
    if (type === "keydown") {
      this.lastAddOptions = options;
      this.listeners.add(listener);
    }
  }

  removeEventListener(
    type: "keydown",
    listener: (event: KeyboardEventLike) => void,
    options?: EventListenerOptions,
  ) {
    if (type === "keydown") {
      this.lastRemoveOptions = options;
      this.listeners.delete(listener);
    }
  }

  dispatch(event: KeyboardEventLike) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

describe("keyboard scope helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects editable focus targets", () => {
    expect(isEditableElement(element("input"))).toBe(true);
    expect(isEditableElement(element("TEXTAREA"))).toBe(true);
    expect(isEditableElement(element("select"))).toBe(true);
    expect(isEditableElement(element("div", true))).toBe(true);
    expect(isEditableElement(element("button"))).toBe(false);
    expect(isEditableElement(null)).toBe(false);

    expect(
      isInputFocused(keyboardDocument({ activeElement: element("input") })),
    ).toBe(true);
    expect(
      isInputFocused(keyboardDocument({ activeElement: element("button") })),
    ).toBe(false);
  });

  it("detects browser and modifier-only shortcuts in one place", () => {
    expect(isBrowserShortcut(keyEvent({ key: "w", ctrlKey: true }))).toBe(true);
    expect(isBrowserShortcut(keyEvent({ key: "l", metaKey: true }))).toBe(true);
    expect(
      isBrowserShortcut(keyEvent({ key: "R", ctrlKey: true, shiftKey: true })),
    ).toBe(true);
    expect(
      isBrowserShortcut(keyEvent({ key: "ArrowLeft", altKey: true })),
    ).toBe(true);
    expect(isBrowserShortcut(keyEvent({ key: "F12" }))).toBe(true);
    expect(isBrowserShortcut(keyEvent({ key: "d", ctrlKey: true }))).toBe(
      false,
    );

    expect(isModifierOnlyKey("Shift")).toBe(true);
    expect(isModifierOnlyKey("j")).toBe(false);
  });

  it("reports open dialogs from the shared document contract", () => {
    expect(hasOpenDialog(keyboardDocument())).toBe(false);
    expect(hasOpenDialog(keyboardDocument({ dialogOpen: true }))).toBe(true);
  });

  it("blocks lower-priority handlers while preserving scoped handlers", () => {
    const dialogDocument = keyboardDocument({ dialogOpen: true });
    const inputDocument = keyboardDocument({
      activeElement: element("textarea"),
    });

    expect(
      shouldHandleKeyboardEvent(keyEvent({ key: "j" }), {
        scope: "global",
        document: dialogDocument,
      }),
    ).toBe(false);
    expect(
      shouldHandleKeyboardEvent(keyEvent({ key: "j" }), {
        scope: "view",
        taskPanelOpen: true,
      }),
    ).toBe(false);
    expect(
      shouldHandleKeyboardEvent(keyEvent({ key: "j" }), {
        scope: "view",
        popoverOpen: true,
      }),
    ).toBe(false);
    expect(
      shouldHandleKeyboardEvent(keyEvent({ key: "1" }), {
        scope: "dialog",
        document: dialogDocument,
      }),
    ).toBe(true);
    expect(
      shouldHandleKeyboardEvent(keyEvent({ key: "s", ctrlKey: true }), {
        scope: "task-panel",
        document: inputDocument,
        ignoreInputFocus: false,
      }),
    ).toBe(true);
    expect(
      shouldHandleKeyboardEvent(keyEvent({ key: "s", ctrlKey: true }), {
        scope: "task-panel",
        document: inputDocument,
      }),
    ).toBe(false);
  });

  it("registers a scoped keydown handler and unregisters it cleanly", () => {
    const target = new KeyboardTarget();
    let calls = 0;

    const unregister = registerScopedKeydown(
      target,
      { scope: "view", taskPanelOpen: true },
      () => {
        calls += 1;
      },
    );

    target.dispatch(keyEvent({ key: "j" }));
    expect(calls).toBe(0);

    unregister();
    target.dispatch(keyEvent({ key: "j" }));
    expect(calls).toBe(0);

    registerScopedKeydown(target, { scope: "view" }, () => {
      calls += 1;
    });
    target.dispatch(keyEvent({ key: "j" }));
    expect(calls).toBe(1);
  });

  it("passes listener options through to scoped keydown registration", () => {
    const target = new KeyboardTarget();
    const unregister = registerScopedKeydown(
      target,
      { scope: "view" },
      () => {},
      { capture: true },
    );

    expect(target.lastAddOptions).toEqual({ capture: true });
    unregister();
    expect(target.lastRemoveOptions).toEqual({ capture: true });
  });

  it("drains pre-hydration keyboard events once React handlers mount", () => {
    const stop = vi.fn();
    vi.stubGlobal("window", {
      __deltaEarlyKeyboard: {
        events: [
          { key: "g", capturedAt: 1000 },
          { key: "c", capturedAt: 1010 },
          { key: "?", capturedAt: 1 },
        ],
        pendingGAt: null,
        stop,
      },
    });

    expect(consumeEarlyKeyboardEvents(1500, 1000)).toEqual([
      { key: "g", capturedAt: 1000 },
      { key: "c", capturedAt: 1010 },
    ]);
    expect(stop).toHaveBeenCalledOnce();
    expect(window.__deltaEarlyKeyboard).toBeUndefined();
  });

  it("replays a pending pre-hydration leader when hydration wins the race", () => {
    const stop = vi.fn();
    vi.stubGlobal("window", {
      __deltaEarlyKeyboard: {
        events: [],
        pendingGAt: 1000,
        stop,
      },
    });

    expect(consumeEarlyKeyboardEvents(1500)).toEqual([
      { key: "g", capturedAt: 1000 },
    ]);
    expect(stop).toHaveBeenCalledOnce();
  });

  it("lets the queue g leader delegate gc to task creation", () => {
    expect(resolveQueuePendingLeaderAction("g", "g")).toBe("jump-top");
    expect(resolveQueuePendingLeaderAction("?", "g")).toBe("help");
    expect(resolveQueuePendingLeaderAction("c", "g")).toBe("create");
    expect(resolveQueuePendingLeaderAction("x", "g")).toBeNull();
  });

  it("lets the calendar g leader delegate global continuations", () => {
    expect(resolveCalendarPendingLeaderAction("g", "g")).toBe("scroll-top");
    expect(resolveCalendarPendingLeaderAction("?", "g")).toBe("help");
    expect(resolveCalendarPendingLeaderAction("c", "g")).toBe("create");
    expect(resolveCalendarPendingLeaderAction("x", "g")).toBeNull();
  });
});
