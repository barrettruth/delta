#!/usr/bin/env bash
set -euo pipefail

FONT_DIR="src/fonts"
BASE_URL="https://www.barrettruth.com/fonts"

if [ -f "$FONT_DIR/BerkeleyMono-Regular.ttf" ] && [ -f "$FONT_DIR/Signifier-Regular.ttf" ]; then
  echo "==> Fonts already present, skipping download"
  exit 0
fi

echo "==> Downloading fonts"
mkdir -p "$FONT_DIR"

curl -sfL "$BASE_URL/berkeley-mono/BerkeleyMono-Regular.ttf" -o "$FONT_DIR/BerkeleyMono-Regular.ttf"
curl -sfL "$BASE_URL/berkeley-mono/BerkeleyMono-Italic.ttf" -o "$FONT_DIR/BerkeleyMono-Italic.ttf"
curl -sfL "$BASE_URL/berkeley-mono/BerkeleyMono-Bold.ttf" -o "$FONT_DIR/BerkeleyMono-Bold.ttf"
curl -sfL "$BASE_URL/berkeley-mono/BerkeleyMono-BoldItalic.ttf" -o "$FONT_DIR/BerkeleyMono-BoldItalic.ttf"
curl -sfL "$BASE_URL/signifier/Signifier-Regular.ttf" -o "$FONT_DIR/Signifier-Regular.ttf"

echo "==> Fonts downloaded"
