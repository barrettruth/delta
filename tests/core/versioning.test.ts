import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readJson(path: string) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

describe("release version surfaces", () => {
  it("keeps the generated CLI manpage version tied to cli/package.json", () => {
    const cliVersion = readJson("cli/package.json").version;
    const manpage = readFileSync(join(root, "cli/man/delta.1"), "utf8");

    expect(manpage.split("\n", 1)[0]).toContain(`"${cliVersion}"`);
  });

  it("routes package releases through the just release recipe", () => {
    const pkg = readJson("package.json");

    expect(pkg.scripts.release).toBe("just release");
  });

  it("does not keep stale version wrapper scripts", () => {
    const staleWrappers = [
      "scripts/bump-version.sh",
      "scripts/version/bump-app.sh",
      "scripts/version/bump-cli.sh",
      "scripts/version/next-version.sh",
    ];

    expect(
      staleWrappers.filter((path) => existsSync(join(root, path))),
    ).toEqual([]);
  });
});
