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
git -C "$TMP/src" checkout --quiet FETCH_HEAD -- lost_traits_bf/alt-art
for lang in en es; do
  mkdir -p "$HERE/cards/$lang"
  # A house rule's faces keep the official code they rebuild: alt-art/<lang>/<code>.webp -> cards/<lang>/<code>.webp.
  cp "$TMP/src/lost_traits_bf/alt-art/$lang/"*.webp "$HERE/cards/$lang/"
done
echo "Pictures written to $HERE/cards."
