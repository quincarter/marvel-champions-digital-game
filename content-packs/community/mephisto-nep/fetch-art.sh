#!/usr/bin/env sh
# Rebuilds the pack's pictures (cards/<lang>/ and alt-art/<lang>/) for a local build. They are not in git
# (.gitignore); the pack-art bundle in the content repo's releases carries them.
#
#   sh fetch-art.sh                          Spanish card faces and the Spanish Standard/Expert art, fetched from the
#                                            curated source repository at the commit below.
#   sh fetch-art.sh "/path/to/Mephisto"      the same, and the English pictures too: converted from the author's own
#                                            download (the folder that holds "Scenario Pack/"), through convert-art.cjs.
#
# English: the author distributes the pack in the community Discord and there is no public repository for his files,
# so the English pictures come from his download (convert-art.cjs, which needs Node and the `sharp` package; run it
# inside the repository, `mise exec -- sh fetch-art.sh ...`). The curated repository carries the same art re-encoded,
# so only the Spanish pictures are taken from it.
set -eu
REPO=https://github.com/bluefireF5ran/mc-digital-custom-packs
COMMIT=a51e50da556ece0b0fe9a75848320416b8794cef
HERE=$(cd "$(dirname "$0")" && pwd)

if [ "${1:-}" ]; then
  node "$HERE/convert-art.cjs" "$1" "$HERE"
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
# The store cover (pack.json "cover", git-ignored like the pictures), from the commit that added the curated
# covers: a blob-less fetch, then just that one file.
COVER_COMMIT=a51e50da556ece0b0fe9a75848320416b8794cef
git init --quiet "$TMP/cover"
git -C "$TMP/cover" remote add origin "$REPO"
git -C "$TMP/cover" fetch --quiet --depth 1 --filter=blob:none origin "$COVER_COMMIT"
git -C "$TMP/cover" show "FETCH_HEAD:mephisto_nep/cover.webp" > "$HERE/cover.webp"
git init --quiet "$TMP/src"
git -C "$TMP/src" fetch --quiet --depth 1 "$REPO" "$COMMIT"
git -C "$TMP/src" checkout --quiet FETCH_HEAD -- mephisto_nep/images mephisto_nep/alt-art
SRC="$TMP/src/mephisto_nep"
mkdir -p "$HERE/cards/es" "$HERE/alt-art/es"

# The curated file names (mephisto_nep_<his code>.webp) -> the codes of cards/*.json (x.mephisto-nep.<code>.webp).
# Villain stages I/II/III = 01/01b/01c, main scheme faces 1A..3B = 02a..02f, Gateway/Hell = 03a/03b.
while read -r theirs ours; do
  cp "$SRC/images/es/mephisto_nep_$theirs.webp" "$HERE/cards/es/x.mephisto-nep.$ours.webp"
done <<MAP
01 01
02 01b
03 01c
04a 02a
04b 02b
05a 02c
05b 02d
06a 02e
06b 02f
07a 03a
07b 03b
08 04
09 05
10 06
11 07
12 08
13 09
14 10
15 11
16 12
17 13
18 14
19 15
20 16
21 17
23 18
24 19
26 20
28 21
b01 22
b02 23
b03 24
b04 25
co01 26
co02 27
co03 28
co04 29
co05 30
d01 31
d02 32
d03 33
d05 34
d06 35
d07 36
d09 37
d10 38
d11 39
d12 40
mod01 41
mod02 42
mod03 43
mod04 44
MAP

# Alternate art keeps its official card codes (01186.webp ... 01193.webp). English is the author's, from his download.
cp "$SRC/alt-art/es/"*.webp "$HERE/alt-art/es/"
echo "Pictures written to $HERE/cover.webp, $HERE/cards and $HERE/alt-art."
