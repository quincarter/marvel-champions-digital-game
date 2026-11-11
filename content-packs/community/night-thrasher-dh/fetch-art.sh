#!/usr/bin/env sh
# Fetches the pack's pictures (cards/<lang>/ and alt-art/<lang>/) from the curated source repository, for a local build.
# They are not in git (.gitignore); the content repo's release bundles carry them. Usage: sh fetch-art.sh
set -eu
REPO=https://github.com/bluefireF5ran/mc-digital-custom-packs
COMMIT=9ce0a25ec5b1b6f08b3a926838d9295babe69758
HERE=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
git clone --quiet --filter=blob:none --no-checkout "$REPO" "$TMP/src"
git -C "$TMP/src" checkout --quiet "$COMMIT" -- night_thrasher_dh/images night_thrasher_dh/alt-art
SRC="$TMP/src/night_thrasher_dh"
for lang in en es; do
  mkdir -p "$HERE/cards/$lang" "$HERE/alt-art/$lang"
  # The importer's names: night_thrasher_dh_NN[a|b].webp -> x.night-thrasher-dh.NN[a|b].webp (the codes of cards/*.json).
  for file in "$SRC/images/$lang/"*.webp; do
    name=$(basename "$file")
    cp "$file" "$HERE/cards/$lang/x.night-thrasher-dh.${name#night_thrasher_dh_}"
  done
  # The alternate alter-ego: night_thrasher_dh_01b-alt.webp -> x.night-thrasher-dh.01b.webp (the key of pack.json's altArt).
  for file in "$SRC/alt-art/$lang/"*-alt.webp; do
    name=$(basename "$file")
    rest=${name#night_thrasher_dh_}
    cp "$file" "$HERE/alt-art/$lang/x.night-thrasher-dh.${rest%-alt.webp}.webp"
  done
done
echo "Pictures written to $HERE/cards and $HERE/alt-art."
