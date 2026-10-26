#!/usr/bin/env bash
# Install for Steam (macOS): adds the installed Marvel Champions app to Steam as a non-Steam game, with the game's icon
# and library art, so it plays from the library and Big Picture with a controller.
#
#   bash install-for-steam.sh [options]
#
# Install the game first (drag it from the release's .dmg into Applications); the script finds it. Steam must be closed
# while its shortcut list is written; the script offers to close it.
#
# Options:
#   --app <path>        the game's .app, when it isn't in /Applications or ~/Applications
#   --steam-dir <path>  the Steam folder, when it isn't ~/Library/Application Support/Steam
#   --yes               close Steam without asking when it is running
#   --uninstall         remove the Steam entry and its art (the game itself stays installed)
#   -h, --help          this text
#
# Needs only what macOS ships: bash, perl and curl.
set -euo pipefail

REPO="quincarter/marvel-champions-digital-game"
# The release staging step (scripts/stage-release-assets.mjs) stamps the release's tag here, so a script downloaded
# from a release fetches that release's art. A copy run from the repo uses main's.
ART_REF="__MC_RELEASE_TAG__"
case "$ART_REF" in __*) ART_REF="main" ;; esac

APP_NAME="Marvel Champions"
BUNDLE_ID="com.quincarter.marvelchampions"
ART_FILES=(icon.png portrait.jpg wide.jpg hero.jpg logo.png)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

app=""
steam_root="$HOME/Library/Application Support/Steam"
assume_yes=0
uninstall=0

usage() { sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d; s/^# \{0,1\}//'; }
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

command -v perl > /dev/null || die "perl is needed to edit Steam's shortcut list."

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
    [ -t 0 ] || die "Steam is running. Quit it (Steam > Quit Steam) and run this again, or pass --yes to have it closed."
    printf 'Steam is running and would overwrite the change when it quits. Quit Steam now? [Y/n] '
    read -r answer
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

if [ -z "$app" ]; then
  for candidate in "/Applications/$APP_NAME.app" "$HOME/Applications/$APP_NAME.app"; do
    if [ -d "$candidate" ]; then
      app="$candidate"
      break
    fi
  done
fi
if [ -z "$app" ] && command -v mdfind > /dev/null; then
  app="$(mdfind "kMDItemCFBundleIdentifier == '$BUNDLE_ID'" 2> /dev/null | grep '\.app$' | head -n 1 || true)"
fi
if [ "$uninstall" = 0 ]; then
  [ -n "$app" ] && [ -d "$app" ] ||
    die "the game isn't in Applications. Install it from the release's .dmg, or pass --app with the path to $APP_NAME.app."
  app="$(cd "$app" && pwd)"
  say "Game: $app"
fi
[ -n "$app" ] || app="/Applications/$APP_NAME.app"

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
  if ((field($e, "Exe") // "") eq $quoted || (field($e, "AppName") // "") eq $name) {
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
    for id in $(vdf_tool remove "$config/shortcuts.vdf" "$app" "$APP_NAME"); do
      while read -r file; do rm -f "$config/grid/$file"; done < <(art_names "$id")
    done
  done
  say "Removed $APP_NAME from Steam. Start Steam again to see the change."
  exit 0
fi

# --- The art ---------------------------------------------------------------------------------------------------------

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
art_dir=""
for dir in "$SCRIPT_DIR/../linux/steam-art" "$SCRIPT_DIR/steam-art"; do
  if [ -f "$dir/hero.jpg" ]; then
    art_dir="$dir"
    break
  fi
done
if [ -z "$art_dir" ]; then
  art_dir="$tmp_dir"
  say "Downloading the library art..."
  for file in "${ART_FILES[@]}"; do
    curl -fsSL -o "$art_dir/$file" "https://raw.githubusercontent.com/$REPO/$ART_REF/scripts/linux/steam-art/$file" ||
      rm -f "$art_dir/$file"
  done
fi

# --- The Steam entry -------------------------------------------------------------------------------------------------

for user in "${users[@]}"; do
  config="$steam_root/userdata/$user/config"
  grid="$config/grid"
  mkdir -p "$grid"
  # The shortcut's grid id, as vdf_tool works it out, to name the art before the entry that points at the icon.
  id="$(perl -MCompress::Zlib=crc32 -e 'print((crc32("\"$ARGV[0]\"" . $ARGV[1]) | 0x80000000) & 0xFFFFFFFF)' \
    "$app" "$APP_NAME")"
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
  vdf_tool add "$config/shortcuts.vdf" "$app" "$APP_NAME" "$(dirname "$app")/" "$icon" > /dev/null
  say "Added $APP_NAME to Steam user $user."
done

say ""
say "Done. Start Steam: $APP_NAME is in your library."
