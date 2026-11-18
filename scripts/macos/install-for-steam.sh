#!/usr/bin/env bash
# Install for Steam (macOS): adds the installed Marvel Champions app to Steam as a non-Steam game, with the game's icon
# and library art, so it plays from the library and Big Picture with a controller.
#
#   bash install-for-steam.sh [options]
#
# This one file works for every release: it asks GitHub for the latest one, and when the game is missing or older it
# downloads that release's .dmg and copies the game into Applications. Steam must be closed while its shortcut list is
# written; the script offers to close it.
#
# Each run records the install in ~/.marvel-champions/ with a copy of this script. The game reads that record, says it
# was installed this way, and offers to run the copy with --update when a new release is out.
#
# Options:
#   --app <path>        the game's .app, when it isn't in /Applications or ~/Applications
#   --steam-dir <path>  the Steam folder, when it isn't ~/Library/Application Support/Steam
#   --language <xx>     the card language to install, en or es (default: what the last run installed, else en)
#   --update            update the game only: leave Steam alone, so it can run while Steam and the game are open
#   --wait-pid <n>      with --update, download first, then wait for this process to end before replacing the game
#   --keep-game <v>     add the --app named, version <v>, as it is: no looking up or downloading the latest release
#                       (the game's own Add to Steam button runs the script this way, src-tauri/src/steam_add.rs)
#   --yes               close Steam without asking when it is running
#   --uninstall         remove the Steam entry, its art and ~/.marvel-champions (the game itself stays installed)
#   -h, --help          this text
#
# Needs only what macOS ships: bash, perl and curl.
set -euo pipefail

REPO="quincarter/marvel-champions-digital-game"

APP_NAME="Marvel Champions"
# The shortcut's name: what Steam, Big Picture and status plugins (Discord) show.
SHORTCUT_NAME="Marvel Champions Digital Edition"
BUNDLE_ID="com.quincarter.marvelchampions"
# The hidden folder the game reads (src-tauri/src/steam_install.rs).
STATE_DIR="$HOME/.marvel-champions"
MARKER="$STATE_DIR/install.json"
ART_FILES=(icon.png portrait.jpg wide.jpg hero.jpg logo.png)
# Empty when this runs from a pipe (curl ... | bash).
SELF="${BASH_SOURCE[0]:-}"
SCRIPT_DIR="$(cd "$(dirname "$SELF")" && pwd)"

app=""
steam_root="$HOME/Library/Application Support/Steam"
assume_yes=0
uninstall=0
update=0
wait_pid=""
keep_game=""
language=""

usage() { sed -n '2,/^set -euo/p' "$SELF" | sed '$d; s/^# \{0,1\}//'; }
say() { printf '%s\n' "$*"; }
die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --app)
      app="${2:?--app needs a path}"
      shift
      ;;
    --steam-dir)
      steam_root="${2:?--steam-dir needs a path}"
      shift
      ;;
    --language)
      language="$(printf '%s' "${2:?--language needs a language}" | tr '[:upper:]' '[:lower:]')"
      shift
      ;;
    --update) update=1 ;;
    --wait-pid)
      wait_pid="${2:?--wait-pid needs a process id}"
      shift
      ;;
    --keep-game)
      keep_game="${2:?--keep-game needs a version}"
      shift
      ;;
    --yes | -y) assume_yes=1 ;;
    --uninstall) uninstall=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    *) die "unknown option $1 (see --help)" ;;
  esac
  shift
done

case "$language" in '' | [a-z][a-z]) ;; *) die "--language takes a two-letter language, en or es." ;; esac
case "$wait_pid" in *[!0-9]*) die "--wait-pid takes a process id." ;; esac
case "$keep_game" in '' | [0-9]*.[0-9]*.[0-9]*) ;; *) die "--keep-game takes the game's version, like 1.2.3." ;; esac
[ -z "$keep_game" ] || [ -n "$app" ] || die "--keep-game needs --app."
command -v perl > /dev/null || die "perl is needed to edit Steam's shortcut list."

# A field of the install record, or nothing when there is no record.
marker_value() {
  perl -MJSON::PP -e '
open(my $fh, "<:raw", $ARGV[0]) or exit 0; local $/; print JSON::PP->new->utf8->decode(<$fh>)->{$ARGV[1]} // "";
' "$MARKER" "$1" 2> /dev/null || true
}

asked_language="$language"
[ -n "$language" ] || language="$(marker_value language)"
[ -n "$language" ] || language="en"

# Whether the game at $1 is the latest in the language asked for. With no language asked for, the one it has is fine.
is_latest() {
  [ -d "$1" ] && [ "$(app_version "$1")" = "$latest_version" ] &&
    { [ -z "$asked_language" ] || [ "$(marker_value language)" = "$language" ]; }
}

# Sets latest_version and latest_url to the latest release and its .dmg for this Mac and the chosen language. GitHub's
# "latest" is never a draft or a prerelease.
latest_version=""
latest_url=""
# GitHub's SHA-256 of the .dmg, which the download is checked against before anything is installed from it.
latest_sha256=""
lookup_latest() {
  local chip="Intel-x64" answer
  [ "$(sysctl -n hw.optional.arm64 2> /dev/null || true)" = 1 ] && chip="AppleSilicon-arm64"
  answer="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" 2> /dev/null | perl -MJSON::PP -e '
my ($lang, $chip) = @ARGV; local $/;
my $release = JSON::PP->new->utf8->decode(scalar <STDIN>);
(my $version = $release->{tag_name}) =~ s/^v//;
my ($dmg) = grep { $_->{name} =~ /-\U$lang\E-macOS-\Q$chip\E\.dmg$/ } @{ $release->{assets} };
my $digest = $dmg && $dmg->{digest} ? $dmg->{digest} : ""; $digest =~ s/^sha256://;
print "$version\t", ($dmg ? $dmg->{browser_download_url} : ""), "\t$digest\n";
' "$language" "$chip")" || return 1
  IFS=$'\t' read -r latest_version latest_url latest_sha256 <<< "$answer"
  [ -n "$latest_url" ]
}

# The version in an installed .app's bundle.
app_version() { defaults read "$1/Contents/Info" CFBundleShortVersionString 2> /dev/null || true; }

# Downloads the release's .dmg and copies its app to $staged, beside the destination, ready to swap in. The name is this
# run's own: one left going by an earlier run of the game must not share it.
staged=""
fetch_app() {
  local dmg="$tmp_dir/game.dmg" mount="$tmp_dir/mount" found
  staged="$1.new.$$"
  say "Downloading version $latest_version..."
  curl -fL --progress-bar -o "$dmg" "$latest_url" || die "the download failed."
  # A cut-off or wrong download is never installed.
  [ "${#latest_sha256}" = 64 ] || die "the release lists no checksum for the .dmg."
  [ "$(shasum -a 256 < "$dmg" | cut -d' ' -f1)" = "$latest_sha256" ] ||
    die "the download doesn't match the release, so nothing changed."
  mkdir -p "$mount"
  hdiutil attach "$dmg" -nobrowse -quiet -mountpoint "$mount" || die "couldn't open the .dmg."
  found="$(find "$mount" -maxdepth 1 -name '*.app' | head -n 1)"
  [ -n "$found" ] || die "the .dmg has no app in it."
  ditto "$found" "$staged" || die "couldn't copy the game to $1."
  hdiutil detach "$mount" -quiet || true
  # The files came from the internet, and an unsigned build would be blocked on its first launch.
  xattr -dr com.apple.quarantine "$staged" 2> /dev/null || true
}

# Trades two paths in one step (renameatx_np with RENAME_SWAP, through perl; AT_FDCWD is -2 on macOS). APFS can; HFS+
# and exFAT can't, and macFUSE has been seen to report success while only renaming one over the other.
swap_paths() { perl -e 'exit(syscall(488, -2, $ARGV[0], -2, $ARGV[1], 2) == 0 ? 0 : 1)' "$1" "$2" 2> /dev/null; }

# Whether apps in $1 can be replaced in one step: two folders in a probe folder of this run's own must really trade
# places. Checked before anything is downloaded, so an update there stops with the game as it was.
can_swap_in() {
  local probe ok=1
  probe="$(mktemp -d "$1/.mc-swap-probe.XXXXXX")" || return 1
  mkdir "$probe/a" "$probe/b" && : > "$probe/a/a" && : > "$probe/b/b" &&
    swap_paths "$probe/a" "$probe/b" && [ -f "$probe/a/b" ] && [ -f "$probe/b/a" ] || ok=0
  rm -rf "$probe"
  [ "$ok" = 1 ]
}

# Puts $staged in $1's place. An app already there is replaced only by trading the two in one step, so no crash or
# power cut can leave the game missing; a disk that can't do that stops here with the old app as it was.
swap_app() {
  if [ ! -d "$1" ]; then
    mv "$staged" "$1" || die "couldn't put the game in $1."
    staged=""
    return
  fi
  swap_paths "$staged" "$1" && [ -d "$staged" ] ||
    die "the disk $1 is on can't replace the app in one step, so the game is unchanged. Install the update from the release's .dmg instead."
  # The old app is at the staged path now.
  rm -rf "$staged"
  staged=""
}

# The copy of this script the game runs. A copy run from a file is what the player chose; run from the saved copy or a
# pipe, the latest published one replaces it, so a fix to this script reaches an existing install.
save_script() {
  local copy="$STATE_DIR/install-for-steam.sh"
  if [ -f "$SELF" ] && [ "$SELF" != "$copy" ]; then
    cp -f "$SELF" "$copy.new"
  elif ! curl -fsSL -o "$copy.new" \
    "https://github.com/$REPO/releases/latest/download/MarvelChampions-macOS-Install-for-Steam.sh" 2> /dev/null; then
    rm -f "$copy.new"
    return 0
  fi
  chmod +x "$copy.new"
  mv -f "$copy.new" "$copy"
}

# Records the install: <version>.
write_marker() {
  mkdir -p "$STATE_DIR"
  perl -MJSON::PP -e '
my ($path, $game, $version, $language, $at) = @ARGV;
my %record = (method => "steam-script", os => "macos", game => $game, version => $version, language => $language,
  installedAt => $at);
open(my $out, ">:raw", "$path.tmp") or die "$path.tmp: $!\n";
print $out JSON::PP->new->utf8->pretty->canonical->encode(\%record); close $out or die "$path.tmp: $!\n";
rename("$path.tmp", $path) or die "$path: $!\n";
' "$MARKER" "$app" "$1" "$language" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  save_script
}

find_app() {
  [ -z "$app" ] || return 0
  for candidate in "/Applications/$APP_NAME.app" "$HOME/Applications/$APP_NAME.app"; do
    if [ -d "$candidate" ]; then
      app="$candidate"
      return 0
    fi
  done
  if command -v mdfind > /dev/null; then
    app="$(mdfind "kMDItemCFBundleIdentifier == '$BUNDLE_ID'" 2> /dev/null | grep '\.app$' | head -n 1 || true)"
  fi
}

tmp_dir="$(mktemp -d)"
trap 'hdiutil detach "$tmp_dir/mount" -quiet > /dev/null 2>&1 || true; rm -rf "$tmp_dir" ${staged:+"$staged"}' EXIT

# --- Update (from the game, or by hand) ----------------------------------------------------------------------------

# The game shows these MC_UPDATE lines' meaning on screen (packages/client/src/view/steam-update.ts). Steam isn't
# touched: the entry already points at the app's path, and Steam may be what started the game.
if [ "$update" = 1 ]; then
  [ -n "$app" ] || app="$(marker_value game)"
  find_app
  [ -n "$app" ] || die "the game isn't in Applications."
  lookup_latest || die "couldn't find the latest release on GitHub."
  if is_latest "$app"; then
    say "MC_UPDATE current $latest_version"
    exit 0
  fi
  can_swap_in "$(dirname "$app")" ||
    die "the disk the game is on can't replace the app in one step, so it can't update itself there. Install the update from the release's .dmg instead."
  fetch_app "$app"
  if [ -n "$wait_pid" ]; then
    # The game went while this downloaded. It may have been started again, so nothing here decides for that one.
    kill -0 "$wait_pid" 2> /dev/null || die "the game closed before the download finished, so nothing changed."
    say "MC_UPDATE ready $latest_version"
    while kill -0 "$wait_pid" 2> /dev/null; do sleep 1; done
  fi
  swap_app "$app"
  write_marker "$latest_version"
  say "MC_UPDATE done $latest_version"
  exit 0
fi

# --- Steam -----------------------------------------------------------------------------------------------------------

[ -d "$steam_root/userdata" ] ||
  die "no Steam install with a signed-in user was found at $steam_root. Start Steam and sign in once, or pass --steam-dir."
say "Steam: $steam_root"

users=()
for dir in "$steam_root"/userdata/*/; do
  id="$(basename "$dir")"
  case "$id" in '' | 0 | *[!0-9]*) continue ;; esac
  users+=("$id")
done
[ "${#users[@]}" -gt 0 ] || die "Steam has no signed-in user yet. Start Steam and sign in once, then run this again."

steam_running() { pgrep -x steam_osx > /dev/null 2>&1; }

if steam_running; then
  if [ "$assume_yes" = 0 ]; then
    # The terminal, not stdin: run from a pipe (curl ... | bash), stdin is the script itself.
    { : < /dev/tty; } 2> /dev/null ||
      die "Steam is running. Quit it (Steam > Quit Steam) and run this again, or pass --yes to have it closed."
    printf 'Steam is running and would overwrite the change when it quits. Quit Steam now? [Y/n] '
    read -r answer < /dev/tty
    case "$answer" in [nN]*) die "Steam is still running. Quit it and run this again." ;; esac
  fi
  say "Quitting Steam..."
  osascript -e 'quit app "Steam"' > /dev/null 2>&1 || true
  for _ in $(seq 1 60); do
    steam_running || break
    sleep 1
  done
  steam_running && die "Steam didn't quit within a minute. Quit it from its menu and run this again."
fi

# --- The game --------------------------------------------------------------------------------------------------------

find_app
[ -n "$app" ] || [ "$uninstall" = 0 ] || app="/Applications/$APP_NAME.app"
version=""
if [ "$uninstall" = 0 ] && [ -n "$keep_game" ]; then
  # From the running game: it stays as it is, since replacing it would pull it out from under itself.
  [ -d "$app" ] || die "the game isn't at $app."
  version="$keep_game"
  app="$(cd "$app" && pwd)"
  say "Game: $app"
elif [ "$uninstall" = 0 ]; then
  say "Looking up the latest release..."
  if lookup_latest; then
    version="$latest_version"
    if [ -z "$app" ] || ! is_latest "$app"; then
      if pgrep -x marvel-champions > /dev/null 2>&1; then
        die "the game is running. Close it and run this again."
      fi
      if [ -z "$app" ]; then
        app="/Applications/$APP_NAME.app"
        [ -w /Applications ] || app="$HOME/Applications/$APP_NAME.app"
        mkdir -p "$(dirname "$app")"
      fi
      fetch_app "$app"
      swap_app "$app"
    else
      say "Version $latest_version is already installed."
    fi
  else
    [ -n "$app" ] && [ -d "$app" ] ||
      die "couldn't find the latest release on GitHub, and the game isn't in Applications. Pass --app with the path to $APP_NAME.app."
    say "Couldn't reach GitHub; using the game that's installed."
    version="$(app_version "$app")"
  fi
  app="$(cd "$app" && pwd)"
  say "Game: $app"
fi

# --- Steam's shortcut list -------------------------------------------------------------------------------------------

# Reads and writes Steam's binary shortcuts.vdf and works out the shortcut's id the way Steam does (it names the art in
# the grid folder). Arguments: <add|remove> <shortcuts.vdf> <exe> <name> [start dir] [icon]. Prints the grid ids of
# the entry it wrote and of any it took out, one per line.
vdf_tool() {
  perl -e '
use strict; use warnings; use Compress::Zlib qw(crc32);
my ($cmd, $path, $exe, $name, $start_dir, $icon) = @ARGV;

sub cstr { my ($d, $i) = @_; my $e = index($$d, "\0", $$i); my $s = substr($$d, $$i, $e - $$i); $$i = $e + 1; $s }
# A map is a list of [key, type, value]: type 0 a nested map, 1 a string, 2 a 32-bit number, 7 eight raw bytes.
sub read_map {
  my ($d, $i) = @_; my @m;
  while (1) {
    my $t = ord(substr($$d, $$i, 1)); $$i++;
    return \@m if $t == 8;
    my $k = cstr($d, $i);
    if ($t == 0) { push @m, [$k, 0, read_map($d, $i)] }
    elsif ($t == 1) { push @m, [$k, 1, cstr($d, $i)] }
    elsif ($t == 2) { push @m, [$k, 2, unpack("l<", substr($$d, $$i, 4))]; $$i += 4 }
    elsif ($t == 7) { push @m, [$k, 7, substr($$d, $$i, 8)]; $$i += 8 }
    else { die "unknown field type $t in $path\n" }
  }
}
sub write_map {
  my ($m) = @_; my $o = "";
  for my $f (@$m) {
    my ($k, $t, $v) = @$f; $o .= chr($t) . $k . "\0";
    if ($t == 0) { $o .= write_map($v) } elsif ($t == 1) { $o .= $v . "\0" }
    elsif ($t == 2) { $o .= pack("l<", $v) } else { $o .= $v }
  }
  $o . "\x08"
}
sub field { my ($m, $k) = @_; for (@$m) { return $_->[2] if lc($_->[0]) eq lc($k) } undef }

my $shortcuts = [];
if (-s $path) {
  open(my $fh, "<:raw", $path) or die "$path: $!\n"; local $/; my $d = <$fh>; close $fh;
  my $i = 0; my $root = read_map(\$d, \$i);
  $shortcuts = field($root, "shortcuts") // [];
}

my $quoted = "\"$exe\"";
# The id Steam gives a non-Steam shortcut: the CRC-32 of its target and name with the top bit set. The grid art is named
# by it, unsigned; shortcuts.vdf stores it as a signed 32-bit number.
my $grid = (crc32($quoted . $name) | 0x80000000) & 0xFFFFFFFF;
my (@kept, @removed, $previous);
for my $s (@$shortcuts) {
  my $e = $s->[2];
  # This game s entry under any name it has had (the first draft named it "Marvel Champions"), or one added by hand,
  # which points at the same app.
  my ($target, $title) = (field($e, "Exe") // "", field($e, "AppName") // "");
  (my $leaf = $target) =~ s{^"|"$}{}g; $leaf =~ s{/+$}{}; $leaf =~ s{.*/}{};
  if ($target eq $quoted || $title eq $name || $title eq "Marvel Champions" || $leaf eq "Marvel Champions.app") {
    $previous //= $e;
    my $id = field($e, "appid"); push @removed, $id & 0xFFFFFFFF if defined $id;
  } else { push @kept, $e }
}
if ($cmd eq "add") {
  push @kept, [
    ["appid", 2, $grid - 2**32], ["AppName", 1, $name], ["Exe", 1, $quoted], ["StartDir", 1, "\"$start_dir\""],
    ["icon", 1, $icon], ["ShortcutPath", 1, ""], ["LaunchOptions", 1, ""], ["IsHidden", 2, 0],
    ["AllowDesktopConfig", 2, 1], ["AllowOverlay", 2, 1], ["OpenVR", 2, 0], ["Devkit", 2, 0], ["DevkitGameID", 1, ""],
    ["DevkitOverrideAppID", 2, 0], ["LastPlayTime", 2, $previous ? field($previous, "LastPlayTime") // 0 : 0],
    ["FlatpakAppID", 1, ""], ["tags", 0, $previous ? field($previous, "tags") // [] : []],
  ];
}
if ($cmd eq "add" || $previous) {
  if (-e $path) { system("cp", "-f", $path, "$path.bak") == 0 or die "could not back up $path\n" }
  my $n = 0;
  my $body = write_map([["shortcuts", 0, [map { [$n++ . "", 0, $_] } @kept]]]) . "\x08";
  open(my $out, ">:raw", "$path.tmp") or die "$path.tmp: $!\n"; print $out $body; close $out or die "$path.tmp: $!\n";
  rename("$path.tmp", $path) or die "$path: $!\n";
}
print "$grid\n"; print "$_\n" for @removed;
' "$@"
}

art_names() { printf '%s\n' "${1}p.jpg" "${1}.jpg" "${1}_hero.jpg" "${1}_logo.png" "${1}_icon.png"; }

if [ "$uninstall" = 1 ]; then
  for user in "${users[@]}"; do
    config="$steam_root/userdata/$user/config"
    [ -f "$config/shortcuts.vdf" ] || continue
    for id in $(vdf_tool remove "$config/shortcuts.vdf" "$app" "$SHORTCUT_NAME"); do
      while read -r file; do rm -f "$config/grid/$file"; done < <(art_names "$id")
    done
  done
  rm -rf "$STATE_DIR"
  say "Removed $SHORTCUT_NAME from Steam and deleted $STATE_DIR. Start Steam again to see the change."
  exit 0
fi

# --- The art ---------------------------------------------------------------------------------------------------------

art_dir=""
for dir in "$SCRIPT_DIR/../linux/steam-art" "$SCRIPT_DIR/steam-art"; do
  if [ -f "$dir/hero.jpg" ]; then
    art_dir="$dir"
    break
  fi
done
if [ -z "$art_dir" ]; then
  art_dir="$tmp_dir/art"
  mkdir -p "$art_dir"
  say "Downloading the library art..."
  for file in "${ART_FILES[@]}"; do
    curl -fsSL -o "$art_dir/$file" "https://raw.githubusercontent.com/$REPO/main/scripts/linux/steam-art/$file" ||
      rm -f "$art_dir/$file"
  done
fi

# --- The Steam entry -------------------------------------------------------------------------------------------------

# Whether a shortcut list already has this game, by the script's names for it or the app's path (as the game's own
# check does, src-tauri/src/steam_add.rs).
has_game_entry() {
  [ -f "$1" ] || return 1
  perl -e '
my ($path, $app, @names) = @ARGV; open(my $fh, "<:raw", $path) or exit 1; local $/; my $data = lc(<$fh>);
for my $name (@names) { exit 0 if index($data, "\x01appname\x00" . lc($name) . "\x00") >= 0 }
exit(index($data, lc($app)) >= 0 ? 0 : 1);
' "$1" "$app" "$SHORTCUT_NAME" "$APP_NAME"
}

for user in "${users[@]}"; do
  config="$steam_root/userdata/$user/config"
  # Add to Steam from the game adds the game only where it's missing: an account that has it already keeps its entry,
  # its target and its art as they are.
  if [ -n "$keep_game" ] && has_game_entry "$config/shortcuts.vdf"; then
    say "Steam user $user has $SHORTCUT_NAME already; left as it is."
    continue
  fi
  grid="$config/grid"
  mkdir -p "$grid"
  # The shortcut's grid id, as vdf_tool works it out, to name the art before the entry that points at the icon.
  id="$(perl -MCompress::Zlib=crc32 -e 'print((crc32("\"$ARGV[0]\"" . $ARGV[1]) | 0x80000000) & 0xFFFFFFFF)' \
    "$app" "$SHORTCUT_NAME")"
  # Steam's names for a shortcut's library art: <id>p portrait, <id> wide, <id>_hero, <id>_logo, <id>_icon.
  [ -f "$art_dir/portrait.jpg" ] && cp -f "$art_dir/portrait.jpg" "$grid/${id}p.jpg"
  [ -f "$art_dir/wide.jpg" ] && cp -f "$art_dir/wide.jpg" "$grid/${id}.jpg"
  [ -f "$art_dir/hero.jpg" ] && cp -f "$art_dir/hero.jpg" "$grid/${id}_hero.jpg"
  [ -f "$art_dir/logo.png" ] && cp -f "$art_dir/logo.png" "$grid/${id}_logo.png"
  icon=""
  if [ -f "$art_dir/icon.png" ]; then
    cp -f "$art_dir/icon.png" "$grid/${id}_icon.png"
    icon="$grid/${id}_icon.png"
  fi
  # The first id printed is this entry's; the rest are entries it replaced, whose art is under other ids.
  for old in $(vdf_tool add "$config/shortcuts.vdf" "$app" "$SHORTCUT_NAME" "$(dirname "$app")/" "$icon"); do
    [ "$old" = "$id" ] && continue
    while read -r file; do rm -f "$grid/$file"; done < <(art_names "$old")
  done
  say "Added $SHORTCUT_NAME to Steam user $user."
done

write_marker "$version"

say ""
say "Done. Start Steam: $SHORTCUT_NAME is in your library."
# The game's Add to Steam panel reads this (packages/client/src/view/steam-update.ts).
if [ -n "$keep_game" ]; then say "MC_UPDATE added $version"; fi
