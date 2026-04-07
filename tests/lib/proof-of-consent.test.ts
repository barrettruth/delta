import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProofOfConsentPage, { metadata } from "@/app/proof-of-consent/page";

describe("ProofOfConsentPage", () => {
  it("renders the public consent flow for transactional SMS reminders", () => {
    const html = renderToStaticMarkup(createElement(ProofOfConsentPage));

    expect(html).toContain("Proof of SMS consent");
    expect(html).toContain("Settings → Integrations → reminders");
    expect(html).toContain("Authenticated web form");
    expect(html).toContain("Reply STOP to opt out");
    expect(html).toContain("It does not send marketing campaigns");
  });

  it("exports page metadata for the public consent route", () => {
    expect(metadata.title).toBe("Proof of SMS consent | delta");
    expect(metadata.description).toBe(
      "Public documentation of delta's transactional SMS reminder opt-in flow.",
    );
  });
});
