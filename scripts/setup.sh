#!/usr/bin/env bash
set -euo pipefail

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

echo ""
echo "==> Create your account"
read -rp "Username: " username
read -rsp "Password: " password
echo ""

npx tsx scripts/seed.ts "$username" "$password"

echo ""
echo "==> Setup complete. Start the server with:"
echo "    PORT=3001 node .next/standalone/server.js"
