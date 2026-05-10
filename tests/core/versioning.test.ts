import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function readJson(path: string) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

describe("release version surfaces", () => {
  it("keeps README versions tied to package manifests", () => {
    const appVersion = readJson("package.json").version;
    const cliVersion = readJson("cli/package.json").version;
    const readme = readFileSync(join(root, "README.md"), "utf8");

    expect(readme).toContain(
      `| Web app | \`package.json\` | \`${appVersion}\` |`,
    );
    expect(readme).toContain(
      `| CLI | \`cli/package.json\` | \`${cliVersion}\` |`,
    );
  });

  it("keeps the generated CLI manpage version tied to cli/package.json", () => {
    const cliVersion = readJson("cli/package.json").version;
    const manpage = readFileSync(join(root, "cli/man/delta.1"), "utf8");

    expect(manpage.split("\n", 1)[0]).toContain(`"${cliVersion}"`);
  });
});
