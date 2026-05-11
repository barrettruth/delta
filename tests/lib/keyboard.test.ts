import { describe, expect, it } from "vitest";
import {
  handleScopedKeyboardEvent,
  hasOpenDialog,
  isBrowserShortcut,
  isEditableElement,
  isInputFocused,
  isModifierOnlyKey,
  type KeyboardEventLike,
  type KeyboardScopeDocument,
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

  it("runs scoped handlers only when the scope is active", () => {
    let calls = 0;

    const blocked = handleScopedKeyboardEvent(
      keyEvent({ key: "q" }),
      { scope: "global", dialogOpen: true },
      () => {
        calls += 1;
      },
    );

    const handled = handleScopedKeyboardEvent(
      keyEvent({ key: "q" }),
      { scope: "dialog", dialogOpen: true },
      () => {
        calls += 1;
      },
    );

    expect(blocked).toBe(false);
    expect(handled).toBe(true);
    expect(calls).toBe(1);
  });
});
