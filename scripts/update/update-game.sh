#!/usr/bin/env bash
# The game's own updater on macOS and Linux (issue #843): downloads a release's .dmg or AppImage, waits for the game to
# quit, puts the new one in the old one's place and starts the game again.
#
#   update-game.sh <url> <dmg|appimage> <version> <game> <pid>
#
# <game> is the running .app (macOS) or AppImage (Linux). The desktop app carries this file (src-tauri/src/
# self_update.rs writes it to ~/.marvel-champions/ and runs it in its own process group) and reads update.log, where this
# reports the way the Install for Steam script does: MC_UPDATE <state> <version> lines, curl's progress, and an "Error:"
# line when it stops (packages/client/src/view/steam-update.ts).
#
# It downloads first, then waits for the game, so the game is never swapped out from under itself. If the game exits
# before the download ends it gives up, changing nothing.
set -euo pipefail

url="${1:?url}"
kind="${2:?kind}"
version="${3:?version}"
game="${4:?game}"
pid="${5:?pid}"

die() {
  printf 'Error: %s\n' "$*"
  exit 1
}
case "$pid" in '' | *[!0-9]*) die "not a process id: $pid" ;; esac
case "$kind" in dmg | appimage) ;; *) die "this installer can't update itself: $kind" ;; esac
[ -e "$game" ] || die "the game isn't at $game."
parent="$(dirname "$game")"
[ -w "$parent" ] || die "$parent can't be written to, so the game can't replace itself there."

tmp="$(mktemp -d "${TMPDIR:-/tmp}/mc-update.XXXXXX")"
mounted=""
cleanup() {
  if [ -n "$mounted" ]; then hdiutil detach -quiet "$mounted" 2> /dev/null || true; fi
  rm -rf "$tmp"
  rm -f "$game.new"
}
trap cleanup EXIT

printf 'Downloading version %s...\n' "$version"
if [ "$kind" = appimage ]; then
  # Beside the game, so the swap is a rename on one disk.
  download="$game.new"
else
  download="$tmp/update.dmg"
fi
curl -fL --progress-bar -o "$download" "$url" || die "the download failed."
kill -0 "$pid" 2> /dev/null || die "the game closed before the download finished, so nothing changed."
printf 'MC_UPDATE ready %s\n' "$version"
while kill -0 "$pid" 2> /dev/null; do sleep 1; done

if [ "$kind" = appimage ]; then
  chmod +x "$download"
  mv -f "$download" "$game"
else
  mounted="$tmp/mount"
  mkdir "$mounted"
  hdiutil attach -quiet -nobrowse -readonly -mountpoint "$mounted" "$download" || {
    mounted=""
    die "the downloaded disk image wouldn't open."
  }
  app="$(find "$mounted" -maxdepth 1 -name '*.app' -print -quit)"
  [ -n "$app" ] || die "the disk image has no app in it."
  # Copied in beside the old app first, so a failed copy leaves the old one as it was.
  staged="$parent/.$(basename "$game").new"
  rm -rf "$staged"
  ditto "$app" "$staged" || die "the new app couldn't be copied into $parent."
  rm -rf "$game"
  mv "$staged" "$game"
fi
printf 'MC_UPDATE done %s\n' "$version"

# The new game starts on its own, out of this script's process group, with none of the old AppImage's environment.
if [ "$kind" = appimage ]; then
  env -u APPIMAGE -u APPDIR -u ARGV0 -u OWD setsid "$game" > /dev/null 2>&1 < /dev/null &
else
  open -n "$game"
fi
