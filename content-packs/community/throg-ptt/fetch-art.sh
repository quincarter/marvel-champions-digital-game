#!/usr/bin/env sh
# Fetches the pack's pictures (cards/<lang>/) from the curated source repository, for a local build.
# They are not in git (.gitignore); the content repo's release bundles carry them. Usage: sh fetch-art.sh
set -eu
REPO=https://github.com/bluefireF5ran/mc-digital-custom-packs
COMMIT=a51e50da556ece0b0fe9a75848320416b8794cef
HERE=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
git init --quiet "$TMP/src"
git -C "$TMP/src" fetch --quiet --depth 1 "$REPO" "$COMMIT"
git -C "$TMP/src" checkout --quiet FETCH_HEAD -- throg_ptt/images
SRC="$TMP/src/throg_ptt"
for lang in en es; do
  mkdir -p "$HERE/cards/$lang"
  # The importer's names: throg_ptt_NN[a|b].webp -> x.throg-ptt.NN[a|b].webp (the codes of cards/*.json).
  for file in "$SRC/images/$lang/"*.webp; do
    name=$(basename "$file")
    cp "$file" "$HERE/cards/$lang/x.throg-ptt.${name#throg_ptt_}"
  done
done
echo "Pictures written to $HERE/cards."
