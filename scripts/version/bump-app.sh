#!/usr/bin/env bash
set -euo pipefail

BUMP="${1:?Usage: bump-app.sh <patch|minor|major>}"
VERSION="$(./scripts/version/next-version.sh app "$BUMP")"

node -e "const fs=require('fs');const path='package.json';const pkg=JSON.parse(fs.readFileSync(path,'utf8'));pkg.version='${VERSION}';fs.writeFileSync(path,JSON.stringify(pkg,null,2)+'\n');"

printf '%s\n' "$VERSION"
