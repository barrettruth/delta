#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${IN_NIX_SHELL:-}" ]]; then
  exec nix develop -c "$0" "$@"
fi

echo "==> Biome check"
./scripts/biome.sh check .

echo "==> TypeScript check"
pnpm tsc --noEmit

echo "==> Tests"
pnpm vitest run

echo "==> Build"
pnpm build
