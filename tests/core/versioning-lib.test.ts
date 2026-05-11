import { describe, expect, it } from "vitest";

import { replaceCliManVersionLine } from "../../scripts/version/lib.mjs";

describe("version script helpers", () => {
  it("updates the generated CLI manpage version line", () => {
    expect(
      replaceCliManVersionLine('.TH "" "1" "May 2026" "0.0.2"', "0.0.3"),
    ).toBe('.TH "" "1" "May 2026" "0.0.3"');
  });

  it("fails when the CLI manpage version line has no semver string", () => {
    expect(() =>
      replaceCliManVersionLine('.TH "" "1" "May 2026"', "0.0.3"),
    ).toThrow("cli/man/delta.1 is missing a semver version string");
  });
});
