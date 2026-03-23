#!/usr/bin/env bash
set -euo pipefail

if ! command -v biome &>/dev/null; then
  BIOME="nix develop -c biome"
else
  BIOME="biome"
fi

echo "==> Biome check"
$BIOME check .

echo "==> TypeScript check"
pnpm tsc --noEmit

echo "==> Tests"
pnpm vitest run

echo "==> Build"
pnpm build
