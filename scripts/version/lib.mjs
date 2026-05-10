import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const surfaces = {
  app: {
    label: "Web app",
    packagePath: "package.json",
  },
  cli: {
    label: "CLI",
    packagePath: "cli/package.json",
  },
};

export const readmeStart = "<!-- delta:versions:start -->";
export const readmeEnd = "<!-- delta:versions:end -->";

export function rootPath(path) {
  return resolve(root, path);
}

export function readJson(path) {
  return JSON.parse(readFileSync(rootPath(path), "utf8"));
}

export function writeJson(path, value) {
  writeFileSync(rootPath(path), `${JSON.stringify(value, null, 2)}\n`);
}

export function surfaceConfig(surface) {
  const config = surfaces[surface];
  if (!config) {
    throw new Error(`Unknown package: ${surface}`);
  }
  return config;
}

export function readSurfaceVersion(surface) {
  const config = surfaceConfig(surface);
  return readJson(config.packagePath).version;
}

export function writeSurfaceVersion(surface, version) {
  const config = surfaceConfig(surface);
  const pkg = readJson(config.packagePath);
  pkg.version = version;
  writeJson(config.packagePath, pkg);
}

export function readSurfaceVersions() {
  return Object.fromEntries(
    Object.keys(surfaces).map((surface) => [
      surface,
      readSurfaceVersion(surface),
    ]),
  );
}

export function bumpSemver(version, bump) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid semver version: ${version}`);
  }
  const next = version.split(".").map((part) => Number.parseInt(part, 10));
  switch (bump) {
    case "major":
      next[0] += 1;
      next[1] = 0;
      next[2] = 0;
      break;
    case "minor":
      next[1] += 1;
      next[2] = 0;
      break;
    case "patch":
      next[2] += 1;
      break;
    default:
      throw new Error(`Invalid bump type: ${bump}`);
  }
  return next.join(".");
}

export function renderReadmeVersionBlock() {
  const rows = Object.entries(surfaces).map(([surface, config]) => {
    const version = readSurfaceVersion(surface);
    return `| ${config.label} | \`${config.packagePath}\` | \`${version}\` |`;
  });

  return [
    readmeStart,
    "| Surface | Canonical source | Current |",
    "| --- | --- | --- |",
    ...rows,
    readmeEnd,
  ].join("\n");
}

export function syncReadmeVersionBlock({ check = false } = {}) {
  const path = rootPath("README.md");
  const current = readFileSync(path, "utf8");
  const block = renderReadmeVersionBlock();
  const start = current.indexOf(readmeStart);
  const end = current.indexOf(readmeEnd);

  if (start < 0 || end < 0 || end < start) {
    throw new Error("README.md is missing the delta version block markers");
  }

  const next =
    current.slice(0, start) + block + current.slice(end + readmeEnd.length);

  if (check) {
    if (next !== current) {
      throw new Error("README.md version block is out of sync");
    }
    return;
  }

  writeFileSync(path, next);
}

export function checkCliManVersion() {
  const cliVersion = readSurfaceVersion("cli");
  const man = readFileSync(rootPath("cli/man/delta.1"), "utf8");
  const firstLine = man.split("\n", 1)[0] ?? "";
  if (!firstLine.includes(`"${cliVersion}"`)) {
    throw new Error(
      `cli/man/delta.1 version is out of sync with cli/package.json (${cliVersion})`,
    );
  }
}
