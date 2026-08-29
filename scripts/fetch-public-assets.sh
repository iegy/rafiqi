#!/usr/bin/env bash
set -euo pipefail

asset_origin="${RAFIQI_ASSET_ORIGIN:-https://rafiqi.iegy.net}"

mkdir -p public/data public/download public/fonts public/icons

fetch_asset() {
  local relative_path="$1"
  curl --fail --location --retry 3 --silent --show-error \
    "$asset_origin/$relative_path" \
    --output "public/$relative_path"
}

fetch_asset "data/quran.json"
fetch_asset "download/Rafiqi.apk"
fetch_asset "audio-adhan.mp3"
fetch_asset "fonts/noto-sans-arabic.ttf"
fetch_asset "fonts/noto-naskh-arabic.ttf"
fetch_asset "icons/icon-192.png"
fetch_asset "icons/icon-512.png"
