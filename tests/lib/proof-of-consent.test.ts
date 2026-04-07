import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProofOfConsentLayout from "@/app/proof-of-consent/layout";
import ProofOfConsentPage, { metadata } from "@/app/proof-of-consent/page";

describe("ProofOfConsentPage", () => {
  it("renders the public consent flow for transactional SMS reminders", () => {
    const html = renderToStaticMarkup(createElement(ProofOfConsentPage));

    expect(html).toContain("Proof of SMS consent");
    expect(html).toContain("Settings → Integrations → reminders");
    expect(html).toContain("Authenticated web form");
    expect(html).toContain("Reply STOP to opt out");
    expect(html).toContain("It does not send marketing campaigns");
    expect(html).toContain("delta · public compliance document");
  });

  it("exports page metadata for the public consent route", () => {
    expect(metadata.title).toBe("Proof of SMS consent | delta");
    expect(metadata.description).toBe(
      "Public documentation of delta's transactional SMS reminder opt-in flow.",
    );
  });

  it("forces light mode for the route", () => {
    const element = ProofOfConsentLayout({
      children: createElement("div", null, "content"),
    });

    expect(element.props.attribute).toBe("class");
    expect(element.props.forcedTheme).toBe("light");
  });
});
