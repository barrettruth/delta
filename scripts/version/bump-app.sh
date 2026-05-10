#!/usr/bin/env bash
set -euo pipefail

BUMP="${1:?Usage: bump-app.sh <patch|minor|major>}"
node scripts/version/cli.mjs bump app "$BUMP"
