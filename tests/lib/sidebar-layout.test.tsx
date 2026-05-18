import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SidebarInset } from "@/components/ui/sidebar";

describe("SidebarInset", () => {
  it("constrains dashboard content inside the viewport when side panels open", () => {
    const html = renderToStaticMarkup(
      createElement(SidebarInset, null, "content"),
    );

    expect(html).toContain("min-w-0");
    expect(html).toContain("overflow-hidden");
  });
});
