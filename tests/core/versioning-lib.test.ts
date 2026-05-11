import { describe, expect, it } from "vitest";

import {
  assertCliManpageInSync,
  replaceCliManVersionLine,
} from "../../scripts/version/lib.mjs";

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

  it("passes when the rendered and tracked CLI manpages match", () => {
    expect(() =>
      assertCliManpageInSync({
        generated: '.TH "" "1" "May 2026" "0.0.3"\n',
        tracked: '.TH "" "1" "May 2026" "0.0.3"\n',
      }),
    ).not.toThrow();
  });

  it("fails when the rendered CLI manpage drifts from the tracked file", () => {
    expect(() =>
      assertCliManpageInSync({
        generated: '.TH "" "1" "May 2026" "0.0.3"\n.SH NAME\nnew\n',
        tracked: '.TH "" "1" "May 2026" "0.0.3"\n.SH NAME\nold\n',
      }),
    ).toThrow("cli/man/delta.1 is out of sync with cli/man/delta.1.md");
  });
});
