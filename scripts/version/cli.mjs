#!/usr/bin/env node
import {
  bumpSemver,
  checkCliManVersion,
  readSurfaceVersion,
  syncCliManVersion,
  validateSemver,
  writeSurfaceVersion,
} from "./lib.mjs";

function usage() {
  return [
    "Usage:",
    "  node scripts/version/cli.mjs current <app|cli>",
    "  node scripts/version/cli.mjs next <app|cli> <patch|minor|major>",
    "  node scripts/version/cli.mjs bump <app|cli> <patch|minor|major>",
    "  node scripts/version/cli.mjs set <app|cli> <version>",
    "  node scripts/version/cli.mjs check",
  ].join("\n");
}

function fail(message) {
  console.error(message);
  console.error(usage());
  process.exit(1);
}

const [command, ...args] = process.argv.slice(2);

try {
  switch (command) {
    case "current": {
      const [surface] = args;
      if (!surface) fail("Missing surface.");
      console.log(readSurfaceVersion(surface));
      break;
    }
    case "next": {
      const [surface, bump] = args;
      if (!surface || !bump) fail("Missing surface or bump type.");
      console.log(bumpSemver(readSurfaceVersion(surface), bump));
      break;
    }
    case "bump": {
      const [surface, bump] = args;
      if (!surface || !bump) fail("Missing surface or bump type.");
      const version = bumpSemver(readSurfaceVersion(surface), bump);
      writeSurfaceVersion(surface, version);
      if (surface === "cli") {
        syncCliManVersion();
      }
      console.log(version);
      break;
    }
    case "set": {
      const [surface, version] = args;
      if (!surface || !version) fail("Missing surface or version.");
      validateSemver(version);
      writeSurfaceVersion(surface, version);
      if (surface === "cli") {
        syncCliManVersion();
      }
      console.log(version);
      break;
    }
    case "check": {
      checkCliManVersion();
      break;
    }
    default:
      fail("Unknown version command.");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
