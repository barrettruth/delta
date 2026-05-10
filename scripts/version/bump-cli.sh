#!/usr/bin/env bash
set -euo pipefail

BUMP="${1:?Usage: bump-cli.sh <patch|minor|major>}"
node scripts/version/cli.mjs bump cli "$BUMP"
