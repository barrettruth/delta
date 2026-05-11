import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const surfaces = {
  app: {
    packagePath: "package.json",
  },
  cli: {
    packagePath: "cli/package.json",
  },
};

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
  validateSemver(version);
  const config = surfaceConfig(surface);
  const pkg = readJson(config.packagePath);
  pkg.version = version;
  writeJson(config.packagePath, pkg);
}

export function validateSemver(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid semver version: ${version}`);
  }
}

export function bumpSemver(version, bump) {
  validateSemver(version);
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

export function syncCliManVersion({ check = false } = {}) {
  const cliVersion = readSurfaceVersion("cli");
  const path = rootPath("cli/man/delta.1");
  const man = readFileSync(path, "utf8");
  const lines = man.split("\n");
  const firstLine = lines[0] ?? "";
  if (!firstLine.includes(`"${cliVersion}"`)) {
    if (check) {
      throw new Error(
        `cli/man/delta.1 version is out of sync with cli/package.json (${cliVersion})`,
      );
    }
    const nextFirstLine = replaceCliManVersionLine(firstLine, cliVersion);
    lines[0] = nextFirstLine;
    writeFileSync(path, lines.join("\n"));
  }
}

export function checkCliManVersion() {
  syncCliManVersion({ check: true });
}

export function replaceCliManVersionLine(firstLine, cliVersion) {
  const nextFirstLine = firstLine.replace(/"\d+\.\d+\.\d+"/, `"${cliVersion}"`);
  if (nextFirstLine === firstLine) {
    throw new Error("cli/man/delta.1 is missing a semver version string");
  }
  return nextFirstLine;
}
