#!/usr/bin/env bash
set -euo pipefail

required_assets=(
  "public/data/quran.json"
  "public/download/Rafiqi.apk"
  "public/audio-adhan.mp3"
  "public/fonts/noto-sans-arabic.ttf"
  "public/fonts/noto-naskh-arabic.ttf"
  "public/icons/icon-192.png"
  "public/icons/icon-512.png"
)

missing=0
for asset in "${required_assets[@]}"; do
  if [[ ! -s "$asset" ]]; then
    echo "Missing required local asset: $asset" >&2
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

echo "All Rafiqi runtime assets are stored locally in this GitHub repository."
