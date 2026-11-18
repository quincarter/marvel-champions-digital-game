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

# The game starts on its own, out of this script's process group, with none of the old AppImage's environment.
start_game() {
  if [ "$kind" = appimage ]; then
    env -u APPIMAGE -u APPDIR -u ARGV0 -u OWD setsid "$game" > /dev/null 2>&1 < /dev/null &
  else
    open -n "$game"
  fi
}

# The player has quit to install by now, so a failure from here on starts the game they had again, and says why in the
# log, which the game shows on its Title (`platform/self-update.ts`).
give_up() {
  printf 'Error: %s\n' "$*"
  start_game || true
  exit 1
}

install() {
  if [ "$kind" = appimage ]; then
    chmod +x "$download" || return 1
    mv -f "$download" "$game"
    return
  fi
  mounted="$tmp/mount"
  mkdir "$mounted"
  if ! hdiutil attach -quiet -nobrowse -readonly -mountpoint "$mounted" "$download"; then
    mounted=""
    give_up "the downloaded disk image wouldn't open, so the game is unchanged."
  fi
  app="$(find "$mounted" -maxdepth 1 -name '*.app' -print -quit)"
  [ -n "$app" ] || give_up "the disk image has no app in it, so the game is unchanged."
  # Copied in beside the old app first, and the old app kept until the new one is in its place, so a failure at any
  # step leaves a game to start.
  local staged="$parent/.$(basename "$game").new"
  local backup="$parent/.$(basename "$game").old"
  rm -rf "$staged" "$backup"
  ditto "$app" "$staged" || {
    rm -rf "$staged"
    give_up "the new app couldn't be copied into $parent, so the game is unchanged."
  }
  mv "$game" "$backup" || {
    rm -rf "$staged"
    give_up "the old app couldn't be moved aside, so the game is unchanged."
  }
  if ! mv "$staged" "$game"; then
    mv "$backup" "$game" || true
    rm -rf "$staged"
    give_up "the new app couldn't be put in place, so the game is unchanged."
  fi
  rm -rf "$backup"
}

install || give_up "the update couldn't be installed, so the game is unchanged."
printf 'MC_UPDATE done %s\n' "$version"
start_game
