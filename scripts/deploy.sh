#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="/opt/delta"
DB_PATH="/var/lib/delta/data.db"

echo "==> Pulling latest code"
cd "$DEPLOY_DIR"
git pull origin main

echo "==> Installing dependencies"
pnpm install --frozen-lockfile

echo "==> Building"
pnpm build

echo "==> Copying static assets to standalone"
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

echo "==> Running migrations"
DATABASE_URL="$DB_PATH" pnpm db:migrate

echo "==> Restarting service"
systemctl restart delta

echo "==> Deploy complete"
