import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ProviderSettingsList,
  testSettingsProviderApiKey,
} from "@/components/settings/provider-settings-primitives";

describe("provider settings primitives", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders active provider rows and the shared key editor", () => {
    const html = renderToStaticMarkup(
      createElement(ProviderSettingsList, {
        activeProvider: "mapbox",
        inputType: "password",
        keyInput: "test-key",
        keyTarget: "mapbox",
        keyTesting: false,
        onCancelKeyInput: () => {},
        onKeyInputChange: () => {},
        onProviderSelect: () => {},
        onTestKey: () => {},
        providers: [
          { id: "photon", label: "photon" },
          { id: "mapbox", label: "mapbox" },
        ],
      }),
    );

    expect(html).toContain("photon");
    expect(html).toContain("mapbox");
    expect(html).toContain("active");
    expect(html).toContain('type="password"');
    expect(html).toContain("test &amp; save");
  });

  it("tests provider api keys through the shared integration endpoint", async () => {
    const fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ valid: true }),
    });
    vi.stubGlobal("fetch", fetch);

    await expect(
      testSettingsProviderApiKey("mapbox", "test-key"),
    ).resolves.toEqual({ valid: true });
    expect(fetch).toHaveBeenCalledWith("/api/settings/integrations/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "mapbox", apiKey: "test-key" }),
    });
  });
});
