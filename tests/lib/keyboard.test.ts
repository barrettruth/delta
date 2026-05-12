import { describe, expect, it } from "vitest";
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

  addEventListener(
    type: "keydown",
    listener: (event: KeyboardEventLike) => void,
  ) {
    if (type === "keydown") this.listeners.add(listener);
  }

  removeEventListener(
    type: "keydown",
    listener: (event: KeyboardEventLike) => void,
  ) {
    if (type === "keydown") this.listeners.delete(listener);
  }

  dispatch(event: KeyboardEventLike) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

describe("keyboard scope helpers", () => {
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
});
