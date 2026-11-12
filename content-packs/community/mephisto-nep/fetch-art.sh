#!/usr/bin/env sh
# Rebuilds the pack's pictures (cards/en/ and alt-art/en/) from the author's download, for a local build.
# They are not in git (.gitignore); the pack-art bundle in the content repo's releases carries them.
# The author distributes the pack in the community Discord (there is no public repository to clone), so this takes the
# folder you unzipped:   sh fetch-art.sh "/path/to/Mephisto/Mephisto"
# (the folder that holds "Scenario Pack/", "Printouts/" and the page inserts). It needs Node and the `sharp` package;
# run it inside the repository (`mise exec -- sh fetch-art.sh ...`) and convert-art.cjs finds the repository's copy.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
SRC=${1:?"usage: sh fetch-art.sh <unzipped Mephisto folder>"}
node "$HERE/convert-art.cjs" "$SRC" "$HERE"
