#!/usr/bin/env sh
# Fetches the pack's pictures (cards/<lang>/) from the curated source repository, for a local build.
# They are not in git (.gitignore); the content repo's release bundles carry them. Usage: sh fetch-art.sh
set -eu
REPO=https://github.com/bluefireF5ran/mc-digital-custom-packs
COMMIT=a51e50da556ece0b0fe9a75848320416b8794cef
HERE=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
# The store cover (pack.json "cover", git-ignored like the pictures), from the commit that added the curated
# covers (re-cut in d9be74f; the pictures stay at the pin above, none changed since): a blob-less fetch, then just that one file.
COVER_COMMIT=d9be74f3df8e4e3a4f9d9876b962d14ffbb6fd43
git init --quiet "$TMP/cover"
git -C "$TMP/cover" remote add origin "$REPO"
git -C "$TMP/cover" fetch --quiet --depth 1 --filter=blob:none origin "$COVER_COMMIT"
git -C "$TMP/cover" show "FETCH_HEAD:throg_ptt/cover.webp" > "$HERE/cover.webp"
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
echo "Pictures written to $HERE/cover.webp, $HERE/cards."
