#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="/opt/delta"
export DATABASE_URL="${DATABASE_URL:-/var/lib/delta/data.db}"

echo "==> Pulling latest code"
cd "$DEPLOY_DIR"
git config --global --add safe.directory "$DEPLOY_DIR" 2>/dev/null || true
git pull origin main

echo "==> Installing dependencies"
pnpm install --frozen-lockfile

echo "==> Building"
pnpm build

echo "==> Copying static assets to standalone"
if [ -d public ] && [ -n "$(ls -A public 2>/dev/null)" ]; then
  cp -r public .next/standalone/public
fi
cp -r .next/static .next/standalone/.next/static

echo "==> Running migrations"
pnpm db:migrate

echo "==> Restarting service"
systemctl restart delta

echo "==> Deploy complete"
