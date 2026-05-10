#!/usr/bin/env node
import {
  bumpSemver,
  checkCliManVersion,
  readSurfaceVersion,
  syncReadmeVersionBlock,
  writeSurfaceVersion,
} from "./lib.mjs";

function usage() {
  return [
    "Usage:",
    "  node scripts/version/cli.mjs next <app|cli> <patch|minor|major>",
    "  node scripts/version/cli.mjs bump <app|cli> <patch|minor|major>",
    "  node scripts/version/cli.mjs sync-readme [--check]",
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
      syncReadmeVersionBlock();
      console.log(version);
      break;
    }
    case "sync-readme": {
      syncReadmeVersionBlock({ check: args.includes("--check") });
      break;
    }
    case "check": {
      syncReadmeVersionBlock({ check: true });
      checkCliManVersion();
      break;
    }
    default:
      fail("Unknown version command.");
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
