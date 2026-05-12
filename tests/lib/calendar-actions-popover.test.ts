import type React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CalendarActionsPopover } from "@/components/calendar/actions-popover";
import { StatusBarProvider } from "@/contexts/status-bar";

vi.mock("@/components/ui/popover", async () => {
  const { createElement } = await import("react");
  function passthrough(slot: string) {
    return function MockPopoverPart({
      children,
    }: {
      children?: React.ReactNode;
    }) {
      return createElement("div", { "data-slot": slot }, children);
    };
  }

  return {
    Popover: passthrough("popover"),
    PopoverContent: passthrough("popover-content"),
    PopoverTrigger: passthrough("popover-trigger"),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/calendar",
  useRouter: () => ({
    push: () => {},
    refresh: () => {},
  }),
  useSearchParams: () => new URLSearchParams(),
}));

function renderPopover(feedToken: string | null) {
  return renderToStaticMarkup(
    createElement(
      StatusBarProvider,
      null,
      createElement(CalendarActionsPopover, {
        feedToken,
        open: true,
      }),
    ),
  );
}

describe("CalendarActionsPopover", () => {
  it("offers feed generation when no subscription token exists", () => {
    const html = renderPopover(null);

    expect(html).toContain("subscription");
    expect(html).toContain("generate subscription");
    expect(html).not.toContain("copy subscription url");
    expect(html).not.toContain("revoke subscription");
    expect(html).not.toContain("calendar settings");
  });

  it("offers copy and revoke actions for an existing subscription token", () => {
    const html = renderPopover("feed-token");

    expect(html).toContain("subscription");
    expect(html).toContain("copy subscription url");
    expect(html).toContain("revoke subscription");
    expect(html).not.toContain("generate subscription");
  });
});
