#!/usr/bin/env sh
# Fetches the pack's pictures (cards/<lang>/) from the curated source repository, for a local build.
# They are not in git (.gitignore); the content repo's release bundles carry them. Usage: sh fetch-art.sh
set -eu
REPO=https://github.com/bluefireF5ran/mc-digital-custom-packs
COMMIT=a0c9f6000293115a9ecd58da347468ec875d52bb
HERE=$(cd "$(dirname "$0")" && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
# The store cover (pack.json "cover", git-ignored like the pictures), from the commit that added the curated
# covers: a blob-less fetch, then just that one file.
COVER_COMMIT=a51e50da556ece0b0fe9a75848320416b8794cef
git init --quiet "$TMP/cover"
git -C "$TMP/cover" remote add origin "$REPO"
git -C "$TMP/cover" fetch --quiet --depth 1 --filter=blob:none origin "$COVER_COMMIT"
git -C "$TMP/cover" show "FETCH_HEAD:punisher_pk/cover.webp" > "$HERE/cover.webp"
# A sparse checkout of the one folder: a path-limited checkout of a blob-less clone fails on some Git for Windows installs.
git clone --quiet --filter=blob:none --no-checkout --sparse "$REPO" "$TMP/src"
git -C "$TMP/src" sparse-checkout set punisher_pk/images
git -C "$TMP/src" checkout --quiet "$COMMIT"
SRC="$TMP/src/punisher_pk/images"
for lang in en es; do
  mkdir -p "$HERE/cards/$lang"
  # The importer's codes: the source's collector numbers (01-03 the villain's stages, 04a/04b the main scheme, copies'
  # numbers skipped) become x.punisher-pk.<NN>. The villain's stages II and III are the pictures 01b and 01c of card 01.
  for pair in 01:01 02:01b 03:01c 04a:04a 04b:04b 05:05 06:06 07:07 08:08 09:09 13:10 14:11 15:12 16:13 17:14 18:15 \
    19:16 20:17 21:18 22:19 23:20 25:21; do
    cp "$SRC/$lang/punisher_pk_${pair%%:*}.webp" "$HERE/cards/$lang/x.punisher-pk.${pair##*:}.webp"
  done
done
echo "Pictures written to $HERE/cover.webp, $HERE/cards."
