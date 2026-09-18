#!/usr/bin/env bash
# Renders the design canvases in "Marvel Champions game screens/" to PNG tiles
# under docs/design-renders/ so a screen's intended look can be *seen* (the
# Read tool renders PNGs; it cannot render the .dc.html canvases).
#
# The canvases are driven by support.js, which hides <x-dc> until it mounts;
# headless Chrome renders the raw markup fine once that script is stripped. A
# tall window captures with a vertical offset, so each tile is a viewport-sized
# capture of a copy whose <body> is shifted up by a negative margin instead.
#
# Usage: scripts/render-design-canvases.sh            # all canvases
#        scripts/render-design-canvases.sh Components  # one, by slug
# Needs Google Chrome at the default macOS path (override with $CHROME).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/Marvel Champions game screens"
OUT="$ROOT/docs/design-renders"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
TILE_H=1100   # content height per tile; tiles overlap by 100px
VIEW_H=1200
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R "$SRC/uploads" "$TMP/" 2>/dev/null || true

render() {
  local name="$1" width="$2"
  local slug; slug="$(echo "$name" | tr -d ' -')"
  local html="$TMP/$slug.html"
  sed -e 's|<script src="./support.js"></script>||' -e 's|<script src="./image-slot.js"></script>||' "$SRC/$name.dc.html" > "$html"
  printf '\n<script>document.title="H="+document.documentElement.scrollHeight;</script>\n' >> "$html"
  local h; h="$("$CHROME" --headless=new --disable-gpu --force-device-scale-factor=1 --window-size="$width,$VIEW_H" --virtual-time-budget=5000 --dump-dom "file://$html" 2>/dev/null | grep -o '<title>H=[0-9]*' | head -1 | tr -dc 0-9)"
  rm -f "$OUT/${slug}_"*.png
  local i=0 y
  for y in $(seq 0 $TILE_H $((h - 1))); do
    local tile="$TMP/${slug}_t$i.html"
    { cat "$html"; printf '\n<style>body{margin-top:-%dpx!important}</style>\n' "$y"; } > "$tile"
    "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 --window-size="$width,$VIEW_H" --virtual-time-budget=8000 --screenshot="$OUT/${slug}_$(printf %02d "$i").png" "file://$tile" >/dev/null 2>&1
    i=$((i + 1))
  done
  echo "$slug: ${width}x${h} -> $i tiles"
}

mkdir -p "$OUT"
want="${1:-}"
while IFS='|' read -r name width; do
  slug="$(echo "$name" | tr -d ' -')"
  if [ -z "$want" ] || [ "$want" = "$slug" ]; then render "$name" "$width"; fi
done <<'LIST'
Screens - Desktop|1600
Screens - Phone|2000
Screens - Tablet|2000
Board - Long Table|1600
Board - Phone|1600
Components|1600
LIST
