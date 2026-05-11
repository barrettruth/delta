import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IntegrationsSection } from "@/components/settings/integrations-section";
import { StatusBarProvider } from "@/contexts/status-bar";

describe("IntegrationsSection", () => {
  it("renders the narrowed integrations page", () => {
    const html = renderToStaticMarkup(
      createElement(
        StatusBarProvider,
        null,
        createElement(IntegrationsSection),
      ),
    );

    expect(html).toContain("integrations");
    expect(html).toContain("Manage external services that connect to delta.");
    expect(html).toContain("connected services");
    expect(html).toContain(
      "Calendar provider setup lives in the calendar settings page.",
    );
  });
});
