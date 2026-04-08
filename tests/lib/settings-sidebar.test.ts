import {
  createElement,
  type ForwardedRef,
  forwardRef,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SettingsSidebar } from "@/components/settings-sidebar";
import { StatusBarProvider } from "@/contexts/status-bar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings/preferences",
}));

vi.mock("next/link", () => ({
  default: forwardRef(function LinkMock(
    {
      children,
      href,
      ...props
    }: {
      children: ReactNode;
      href: string;
    },
    ref: ForwardedRef<HTMLAnchorElement>,
  ) {
    return createElement("a", { ...props, href, ref }, children);
  }),
}));

describe("SettingsSidebar", () => {
  it("renders settings navigation without the inline movement hint", () => {
    const html = renderToStaticMarkup(
      createElement(
        StatusBarProvider,
        null,
        createElement(SettingsSidebar, { username: "barrett" }),
      ),
    );

    expect(html).toContain("settings");
    expect(html).toContain("calendar");
    expect(html).toContain("preferences");
    expect(html).not.toContain("j/k move");
  });
});
