import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShortcutsSection } from "@/components/settings/shortcuts-section";

describe("ShortcutsSection", () => {
  it("renders keyboard help inside the settings surface", () => {
    const html = renderToStaticMarkup(createElement(ShortcutsSection));

    expect(html).toContain("shortcuts");
    expect(html).toContain("global");
    expect(html).toContain("g?");
    expect(html).toContain("This help");
    expect(html).toContain("lg:grid-cols-2");
  });
});
