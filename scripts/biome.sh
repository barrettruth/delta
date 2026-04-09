#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${IN_NIX_SHELL:-}" ]] && command -v biome >/dev/null 2>&1; then
  exec biome "$@"
fi

if [[ -e /etc/NIXOS ]] && command -v nix >/dev/null 2>&1; then
  exec nix develop -c biome "$@"
fi

if command -v biome >/dev/null 2>&1; then
  exec biome "$@"
fi

exec pnpm exec biome "$@"
