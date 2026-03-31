#!/usr/bin/env bash
set -euo pipefail

PACKAGE="${1:?Usage: next-version.sh <package> <patch|minor|major>}"
BUMP="${2:?Usage: next-version.sh <package> <patch|minor|major>}"

case "$PACKAGE" in
  cli) PKG_PATH="cli/package.json" ;;
  *) echo "Unknown package: $PACKAGE" >&2; exit 1 ;;
esac

CURRENT=$(node -p "require('./$PKG_PATH').version")
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
  *) echo "Invalid bump type: $BUMP" >&2; exit 1 ;;
esac

echo "${MAJOR}.${MINOR}.${PATCH}"
