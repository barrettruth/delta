#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ] || [[ ! "$1" =~ ^(major|minor|patch)$ ]]; then
  echo "Usage: $0 <major|minor|patch>" >&2
  exit 1
fi

bump_type="$1"
pkg="package.json"

current=$(node -p "require('./${pkg}').version")
IFS='.' read -r major minor patch <<< "$current"

case "$bump_type" in
  major) major=$((major + 1)); minor=0; patch=0 ;;
  minor) minor=$((minor + 1)); patch=0 ;;
  patch) patch=$((patch + 1)) ;;
esac

new_version="${major}.${minor}.${patch}"

node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('${pkg}', 'utf8'));
pkg.version = '${new_version}';
fs.writeFileSync('${pkg}', JSON.stringify(pkg, null, 2) + '\n');
"

echo "$new_version"
