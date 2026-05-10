#!/usr/bin/env bash
set -euo pipefail

PACKAGE="${1:?Usage: next-version.sh <app|cli> <patch|minor|major>}"
BUMP="${2:?Usage: next-version.sh <app|cli> <patch|minor|major>}"

node scripts/version/cli.mjs next "$PACKAGE" "$BUMP"
