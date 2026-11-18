#!/usr/bin/env bash
# The game's own updater on macOS and Linux (issue #843): downloads a release's .dmg, AppImage, .deb or .rpm, waits for
# the game to quit, puts the new one in the old one's place and starts the game again.
#
#   update-game.sh <url> <dmg|appimage|deb|rpm> <version> <game> <pid> <sha256>
#
# <game> is the running .app (macOS), AppImage, or the installed package's game (Linux). A .deb or .rpm is installed as
# root through polkit (pkexec), which asks for an administrator's password. The desktop app carries this file (src-tauri/src/
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
# The download's SHA-256 as the release lists it: one that doesn't match is never installed.
sha256="$(printf '%s' "${6:?sha256}" | tr '[:upper:]' '[:lower:]')"

die() {
  printf 'Error: %s\n' "$*"
  exit 1
}
case "$pid" in '' | *[!0-9]*) die "not a process id: $pid" ;; esac
case "$kind" in dmg | appimage | deb | rpm) ;; *) die "this installer can't update itself: $kind" ;; esac
case "$sha256" in *[!0-9a-f]*) die "not a SHA-256: $sha256" ;; esac
[ "${#sha256}" = 64 ] || die "not a SHA-256: $sha256"
[ -e "$game" ] || die "the game isn't at $game."
parent="$(dirname "$game")"
case "$kind" in
  deb | rpm) command -v pkexec > /dev/null || die "pkexec is needed to install the package as an administrator." ;;
  *) [ -w "$parent" ] || die "$parent can't be written to, so the game can't replace itself there." ;;
esac

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
  download="$tmp/update.$kind"
fi
curl -fL --progress-bar -o "$download" "$url" || die "the download failed."
if command -v sha256sum > /dev/null; then
  got="$(sha256sum < "$download" | cut -d' ' -f1)"
else
  got="$(shasum -a 256 < "$download" | cut -d' ' -f1)"
fi
[ "$got" = "$sha256" ] || die "the download doesn't match the release, so nothing changed."
kill -0 "$pid" 2> /dev/null || die "the game closed before the download finished, so nothing changed."
printf 'MC_UPDATE ready %s\n' "$version"
while kill -0 "$pid" 2> /dev/null; do sleep 1; done

# The game starts on its own, out of this script's process group, with none of the old AppImage's environment.
start_game() {
  if [ "$kind" != dmg ]; then
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

# Swaps two paths in one step on APFS (renameatx_np with RENAME_SWAP, through the perl macOS ships), so no moment
# passes, not even a crash or a power cut, with no app at the game's path. AT_FDCWD is -2 on macOS.
swap_paths() {
  perl -e 'exit(syscall(488, -2, $ARGV[0], -2, $ARGV[1], 2) == 0 ? 0 : 1)' "$1" "$2" 2> /dev/null
}

install() {
  if [ "$kind" = appimage ]; then
    # rename(2) puts the new AppImage over the old in one step: at every moment one of them is the game.
    chmod +x "$download" || return 1
    mv -f "$download" "$game" || give_up "the new AppImage couldn't be put in place, so the game is unchanged."
    return
  fi
  if [ "$kind" = deb ] || [ "$kind" = rpm ]; then
    # The package manager replaces the old version in one step, so a refused password or a failed install leaves it.
    local installed=0
    if [ "$kind" = deb ]; then
      pkexec dpkg -i "$download" && installed=1
    else
      pkexec rpm -U --replacepkgs "$download" && installed=1
    fi
    [ "$installed" = 1 ] || give_up "the package wasn't installed (no administrator's password?), so the game is unchanged."
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
  # Copied in beside the old app first, so a failed copy leaves the old one as it was.
  local staged="$parent/.$(basename "$game").new"
  rm -rf "$staged"
  ditto "$app" "$staged" || {
    rm -rf "$staged"
    give_up "the new app couldn't be copied into $parent, so the game is unchanged."
  }
  if swap_paths "$staged" "$game"; then
    # The old app is at the staged path now.
    rm -rf "$staged"
    return
  fi
  # A disk that can't swap (not APFS): two renames, the old app kept until the new one is in place.
  local backup="$parent/.$(basename "$game").old"
  rm -rf "$backup"
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
