import { describe, expect, it } from "vitest";
import {
  buildGeocodingUrl,
  GEOCODING_PROVIDER,
  parseGeocodingResults,
} from "@/core/geocoding";

describe("geocoding provider contract", () => {
  it("keeps v0.1 location lookup on Photon", () => {
    expect(GEOCODING_PROVIDER).toEqual({ id: "photon", label: "photon" });
    expect(buildGeocodingUrl("New York")).toBe(
      "https://photon.komoot.io/api?q=New%20York&limit=10",
    );
  });

  it("maps Photon features to location suggestions", () => {
    const results = parseGeocodingResults({
      features: [
        {
          properties: {
            name: "Central Library",
            city: "Austin",
            state: "Texas",
            country: "United States",
          },
          geometry: { coordinates: [-97.742, 30.265] },
        },
      ],
    });

    expect(results).toEqual([
      {
        name: "Central Library",
        displayName: "Central Library, Austin, Texas, United States",
        lat: 30.265,
        lon: -97.742,
      },
    ]);
  });
});
