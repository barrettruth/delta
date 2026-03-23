#!/usr/bin/env bash
set -euo pipefail

echo "==> Biome check"
biome check .

echo "==> TypeScript check"
pnpm tsc --noEmit

echo "==> Tests"
pnpm vitest run

echo "==> Build"
mkdir -p data
DATABASE_URL=./data/ci.db pnpm build
rm -f data/ci.db
