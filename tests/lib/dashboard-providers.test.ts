import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DashboardProviders } from "@/components/dashboard-providers";
import { useKeyboardHelp } from "@/contexts/keyboard-help";
import { useNavigation } from "@/contexts/navigation";
import { useStatusBar } from "@/contexts/status-bar";
import { useTaskPanel } from "@/contexts/task-panel";
import { useUndo } from "@/contexts/undo";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/keyboard-shortcuts-dialog", () => ({
  KeyboardShortcutsDialog: () => null,
}));

function ProviderProbe() {
  const keyboardHelp = useKeyboardHelp();
  const navigation = useNavigation();
  const statusBar = useStatusBar();
  const taskPanel = useTaskPanel();
  const undo = useUndo();

  expect(typeof keyboardHelp.openKeyboardHelp).toBe("function");
  expect(typeof navigation.pushJump).toBe("function");
  expect(typeof statusBar.message).toBe("function");
  expect(typeof taskPanel.open).toBe("function");
  expect(typeof undo.push).toBe("function");

  return createElement(
    "div",
    {
      "data-task-panel-open": String(taskPanel.isOpen),
      "data-undo-available": String(undo.canUndo),
    },
    "dashboard shell",
  );
}

describe("DashboardProviders", () => {
  it("owns the dashboard shell contexts used by navigation and task panels", () => {
    const html = renderToStaticMarkup(
      createElement(DashboardProviders, null, createElement(ProviderProbe)),
    );

    expect(html).toContain("dashboard shell");
    expect(html).toContain('data-task-panel-open="false"');
    expect(html).toContain('data-undo-available="false"');
  });
});
