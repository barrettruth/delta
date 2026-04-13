import {
  createElement,
  type ForwardedRef,
  forwardRef,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppSidebar } from "@/components/app-sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/kanban",
  useSearchParams: () => new URLSearchParams(),
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

vi.mock("@/components/category-color-picker", () => ({
  CategoryColorPicker: () => createElement("div"),
}));

vi.mock("@/components/ui/sidebar", () => {
  function wrap(tag: string) {
    return ({
      children,
      ...props
    }: {
      children?: ReactNode;
      [key: string]: unknown;
    }) => createElement(tag, props, children);
  }

  return {
    Sidebar: wrap("aside"),
    SidebarContent: wrap("div"),
    SidebarFooter: wrap("footer"),
    SidebarGroup: wrap("section"),
    SidebarGroupContent: wrap("div"),
    SidebarGroupLabel: wrap("div"),
    SidebarHeader: wrap("header"),
    SidebarMenu: wrap("ul"),
    SidebarMenuItem: wrap("li"),
    SidebarMenuButton: ({
      children,
      render: _render,
      isActive: _isActive,
      ...props
    }: {
      children?: ReactNode;
      render?: ReactNode;
      isActive?: boolean;
      [key: string]: unknown;
    }) => createElement("button", { ...props, type: "button" }, children),
  };
});

vi.mock("@/contexts/keymaps", () => ({
  useKeymaps: () => ({
    getResolvedKeymap: (id: string) => ({
      triggerKey:
        {
          "global.queue": "Q",
          "global.kanban": "K",
          "global.calendar": "C",
          "global.category_jump": "g",
          "global.settings": "S",
        }[id] ?? "?",
    }),
  }),
}));

vi.mock("@/contexts/navigation", () => ({
  useNavigation: () => ({
    pushJump: () => {},
  }),
}));

describe("AppSidebar", () => {
  it("renders the kanban sidebar label in lowercase", () => {
    const html = renderToStaticMarkup(
      createElement(AppSidebar, {
        username: "barrett",
        categories: ["work"],
        categoryColors: {},
      }),
    );

    expect(html).toContain("kanban");
    expect(html).not.toContain("Kanban");
  });
});
