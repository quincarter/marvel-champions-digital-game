#!/usr/bin/env sh
# Fetches the pack's pictures (cards/<lang>/ and alt-art/<lang>/) from the curated source repository, for a local build.
# They are not in git (.gitignore); the content repo's release bundles carry them. Usage: sh fetch-art.sh
set -eu
REPO=https://github.com/bluefireF5ran/mc-digital-custom-packs
COMMIT=9ce0a25ec5b1b6f08b3a926838d9295babe69758
HERE=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
# The store cover (pack.json "cover", git-ignored like the pictures), from the commit that added the curated
# covers: a blob-less fetch, then just that one file.
COVER_COMMIT=a51e50da556ece0b0fe9a75848320416b8794cef
git init --quiet "$TMP/cover"
git -C "$TMP/cover" remote add origin "$REPO"
git -C "$TMP/cover" fetch --quiet --depth 1 --filter=blob:none origin "$COVER_COMMIT"
git -C "$TMP/cover" show "FETCH_HEAD:night_thrasher_dh/cover.webp" > "$HERE/cover.webp"
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
echo "Pictures written to $HERE/cover.webp, $HERE/cards and $HERE/alt-art."
