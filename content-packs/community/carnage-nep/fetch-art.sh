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
git -C "$TMP/src" checkout --quiet "$COMMIT" -- carnage_nep/images carnage_nep/alt-art
SRC="$TMP/src/carnage_nep"
for lang in en es; do
  mkdir -p "$HERE/cards/$lang" "$HERE/alt-art/$lang"
  # The importer's names: carnage_nep_NN[a|b].webp -> x.carnage-nep.NN[a|b].webp (the codes of cards/*.json).
  for file in "$SRC/images/$lang/"*.webp; do
    name=$(basename "$file")
    cp "$file" "$HERE/cards/$lang/x.carnage-nep.${name#carnage_nep_}"
  done
  # Alternate art keeps its official card codes (01088.webp, ...).
  cp "$SRC/alt-art/$lang/"*.webp "$HERE/alt-art/$lang/"
done
echo "Pictures written to $HERE/cards and $HERE/alt-art."
