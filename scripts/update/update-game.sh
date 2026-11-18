#!/usr/bin/env bash
# The game's own updater on macOS and Linux (issue #843): downloads a release's .dmg, AppImage, .deb or .rpm, waits for
# the game to quit, puts the new one in the old one's place and starts the game again.
#
#   update-game.sh <url> <dmg|appimage|deb|rpm> <version> <game> <pid> <sha256>
#
# <game> is the running .app (macOS), AppImage, or the installed package's game (Linux). A .deb or .rpm is installed as
# root through polkit (pkexec), which asks for an administrator's password. The desktop app carries this file
# (src-tauri/src/self_update.rs writes it to ~/.marvel-champions/ and runs it in its own process group) and reads
# update.log, where this reports the way the Install for Steam script does: MC_UPDATE <state> <version> lines, curl's
# progress, and an "Error:" line when it stops (packages/client/src/view/steam-update.ts).
#
# It downloads first, then waits for the game, so the game is never swapped out from under itself. Everything that can
# rule an update out (the checksum, a disk that can't swap an app in one step) is checked before the game is asked to
# quit; if the game exits before then, nothing changes.
set -euo pipefail

url="${1:?url}"
kind="${2:?kind}"
version="${3:?version}"
game="${4:?game}"
pid="${5:?pid}"
# The download's SHA-256 as the release lists it: one that doesn't match is never installed.
sha256="$(printf '%s' "${6:?sha256}" | tr '[:upper:]' '[:lower:]')"
# The .deb's and .rpm's package name (self_update.rs checks the game belongs to it before offering the update).
package="marvel-champions"

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
# The AppImage's download, made beside it under a name of this run's own (mktemp), so the swap is a rename on one disk
# and no file the player or another updater left there is written over or removed. Empty until it exists.
staged_appimage=""
# On macOS, a folder beside the app that this run made (mktemp -d) for the disk's swap check and the new app: the only
# folder there it ever removes. Empty until it exists.
owned_dir=""
cleanup() {
  if [ -n "$mounted" ]; then hdiutil detach -quiet "$mounted" 2> /dev/null || true; fi
  rm -rf "$tmp"
  if [ -n "$staged_appimage" ]; then rm -f "$staged_appimage"; fi
  if [ -n "$owned_dir" ]; then rm -rf "$owned_dir"; fi
  if [ -n "$installing" ]; then rm -f "$installing"; fi
  if [ -n "$lock" ]; then rm -rf "$lock"; fi
}
# While the game is being replaced, this file holds this run's process id, and a game started meanwhile leaves at once
# (src-tauri/src/steam_install.rs, leave_for_running_update) rather than run on half-replaced files. Empty until then.
installing=""
# The update lock this run holds: one update at a time, whichever copy of the game started it. Empty until taken.
lock=""
trap cleanup EXIT

# Two copies of the game running at once could each start an update; the second finds the first's lock (a folder, made
# in one step) and stops, unless the run that left it has died.
state_dir="$HOME/.marvel-champions"
mkdir -p "$state_dir"
if ! mkdir "$state_dir/update.lock" 2> /dev/null; then
  holder="$(cat "$state_dir/update.lock/pid" 2> /dev/null || true)"
  case "$holder" in '' | *[!0-9]*) holder="" ;; esac
  if [ -n "$holder" ] && kill -0 "$holder" 2> /dev/null; then
    die "another copy of the game is already updating it. Wait for that update to finish."
  fi
  rm -rf "$state_dir/update.lock"
  mkdir "$state_dir/update.lock" 2> /dev/null || die "another copy of the game is already updating it."
fi
lock="$state_dir/update.lock"
echo "$$" > "$lock/pid"

# Swaps two paths in one step (renameatx_np with RENAME_SWAP, through the perl macOS ships), so no moment passes, not
# even a crash or a power cut, with no app at the game's path. AT_FDCWD is -2 on macOS. APFS can; HFS+ and exFAT can't.
swap_paths() {
  perl -e 'exit(syscall(488, -2, $ARGV[0], -2, $ARGV[1], 2) == 0 ? 0 : 1)' "$1" "$2" 2> /dev/null
}

# A disk that can't swap is found out now, before the game quits: replacing an app there takes two renames, and a crash
# between them would leave no game, so the game keeps offering the download there instead.
if [ "$kind" = dmg ]; then
  # Each folder holds a file naming it, and both must have traded places: a volume whose swap reports success but only
  # renames one over the other (seen on macFUSE) is caught here.
  owned_dir="$(mktemp -d "$parent/.$(basename "$game").update.XXXXXX")" || die "$parent can't be written to."
  mkdir "$owned_dir/a" "$owned_dir/b"
  : > "$owned_dir/a/a"
  : > "$owned_dir/b/b"
  { swap_paths "$owned_dir/a" "$owned_dir/b" && [ -f "$owned_dir/a/b" ] && [ -f "$owned_dir/b/a" ]; } ||
    die "the disk the game is on can't replace an app in one step, so it can't update itself there. Download the update instead."
  rm -rf "$owned_dir/a" "$owned_dir/b"
fi

printf 'Downloading version %s...\n' "$version"
if [ "$kind" = appimage ]; then
  staged_appimage="$(mktemp "$parent/.$(basename "$game").update.XXXXXX")" || die "$parent can't be written to."
  download="$staged_appimage"
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
# Made before waiting, so even a game restarted the moment this one quits leaves rather than run on the files about to
# be replaced (steam_install.rs, leave_for_running_update). It names this run, which removes it when it's done.
mkdir -p "$HOME/.marvel-champions"
installing="$HOME/.marvel-champions/installing"
printf '%s\n' "$$" > "$installing"
printf 'MC_UPDATE ready %s\n' "$version"
while kill -0 "$pid" 2> /dev/null; do sleep 1; done

# The game starts on its own, out of this script's process group, with none of the old AppImage's environment.
start_game() {
  # Done replacing (or not replacing) the game: it may start again.
  if [ -n "$installing" ]; then rm -f "$installing"; fi
  installing=""
  if [ "$kind" != dmg ]; then
    env -u APPIMAGE -u APPDIR -u ARGV0 -u OWD setsid "$game" > /dev/null 2>&1 < /dev/null &
  else
    open -n "$game"
  fi
}

# The player has quit to install by now, so a failure from here on starts the game they had again, and says why in the
# log, which the game shows on its Title (`platform/self-update.ts`).
give_up() {
  failed_after_quit "$*"
  start_game || true
  exit 1
}

# The reason, then a last report the game reads on its next launch (`view/steam-update.ts`): written last, so it is in
# the end of the log the game reads however much the installer printed before it.
failed_after_quit() {
  printf 'Error: %s\n' "$*"
  printf 'MC_UPDATE failed %s\n' "$version"
}

# The package as the package manager has it: installed and configured, and its version.
package_ok() {
  if [ "$kind" = deb ]; then
    [ "$(dpkg-query -W -f='${Status}' "$package" 2> /dev/null)" = "install ok installed" ]
  else
    rpm -q "$package" > /dev/null 2>&1
  fi
}
package_version() {
  if [ "$kind" = deb ]; then
    dpkg-query -W -f='${Version}' "$package" 2> /dev/null || true
  else
    rpm -q --queryformat '%{VERSION}-%{RELEASE}' "$package" 2> /dev/null || true
  fi
}

# Through the system's package manager, which resolves dependencies (apt, dnf, zypper), else dpkg or rpm alone.
install_package() {
  if [ "$kind" = deb ]; then
    if command -v apt-get > /dev/null; then
      pkexec apt-get install -y --allow-downgrades "$download"
    else
      pkexec dpkg -i "$download"
    fi
  elif command -v dnf > /dev/null; then
    pkexec dnf install -y "$download"
  elif command -v zypper > /dev/null; then
    pkexec zypper --non-interactive install --allow-unsigned-rpm "$download"
  else
    pkexec rpm -U --replacepkgs "$download"
  fi
}

install() {
  if [ "$kind" = appimage ]; then
    # rename(2) puts the new AppImage over the old in one step: at every moment one of them is the game.
    chmod 755 "$download" || return 1
    mv -f "$download" "$game" || give_up "the new AppImage couldn't be put in place, so the game is unchanged."
    staged_appimage=""
    return
  fi
  if [ "$kind" = deb ] || [ "$kind" = rpm ]; then
    local before
    before="$(package_version)"
    install_package && return
    # A refused password changes nothing. A package manager that stopped partway (a maintainer script, a dependency)
    # can leave the package half installed, and the old game may not run; say how to repair it rather than that
    # nothing changed.
    if package_ok && [ "$(package_version)" = "$before" ]; then
      give_up "the package wasn't installed (was the administrator's password refused?), so the game is unchanged."
    fi
    local repair="sudo apt-get -f install"
    [ "$kind" = rpm ] && repair="sudo dnf reinstall $package (or sudo rpm -U --replacepkgs with the release's .rpm)"
    failed_after_quit "the package update stopped partway, so the game may not start. To repair it, run: $repair"
    if package_ok; then
      start_game || true
    else
      # The game may not start to say so on its Title, so the desktop says it, where it has a notifier.
      if [ -n "$installing" ]; then rm -f "$installing"; fi
      installing=""
      if command -v notify-send > /dev/null; then
        notify-send --urgency=critical "Marvel Champions didn't finish updating" \
          "The package update stopped partway. To repair it, run in a terminal: $repair" 2> /dev/null || true
      fi
    fi
    exit 1
  fi
  mounted="$tmp/mount"
  mkdir "$mounted"
  if ! hdiutil attach -quiet -nobrowse -readonly -mountpoint "$mounted" "$download"; then
    mounted=""
    give_up "the downloaded disk image wouldn't open, so the game is unchanged."
  fi
  app="$(find "$mounted" -maxdepth 1 -name '*.app' -print -quit)"
  [ -n "$app" ] || give_up "the disk image has no app in it, so the game is unchanged."
  # Copied in beside the old app first, into this run's own folder, so a failed copy leaves the old one as it was; then
  # the two trade places in one step (the disk was checked above), and the old app, now in that folder, goes with it.
  local staged="$owned_dir/$(basename "$game")"
  ditto "$app" "$staged" || give_up "the new app couldn't be copied into $parent, so the game is unchanged."
  swap_paths "$staged" "$game" || give_up "the new app couldn't be swapped in, so the game is unchanged."
}

install || give_up "the update couldn't be installed, so the game is unchanged."
printf 'MC_UPDATE done %s\n' "$version"
start_game
