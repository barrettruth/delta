#!/usr/bin/env bash
set -euo pipefail

echo "==> Biome check"
biome check .

echo "==> TypeScript check"
pnpm tsc --noEmit

echo "==> Tests"
pnpm vitest run

echo "==> Build"
pnpm build
