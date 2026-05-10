#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ] || [[ ! "$1" =~ ^(major|minor|patch)$ ]]; then
  echo "Usage: $0 <major|minor|patch>" >&2
  exit 1
fi

scripts/version/bump-app.sh "$1"
