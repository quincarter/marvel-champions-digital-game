#!/usr/bin/env bash
# Install for Steam: adds the Marvel Champions AppImage to Steam as a non-Steam game, with the game's icon and
# library art, so it plays from the library, Big Picture and the Steam Deck's Game Mode.
#
#   bash install-for-steam.sh [options] [path/to/MarvelChampions-<version>-Linux-x64.AppImage]
#
# With no AppImage named it takes the newest one next to this script or in ~/Downloads, else downloads the latest
# release's. The AppImage is copied to ~/Applications/MarvelChampions/MarvelChampions.AppImage, so running the script
# again with a newer one updates the game in place and keeps the same Steam entry, art and play time.
#
# Options:
#   --download   download the latest release's AppImage even if one is on disk
#   --yes        close Steam without asking when it is running
#   --uninstall  remove the Steam entry, its art and the installed AppImage
#   -h, --help   this text
#
# Running it again keeps the launch options you added or changed in Steam yourself (your value of a variable wins over
# the script's), and refreshes the rest.
#
# Needs bash, python3 and curl (curl only to download). Steam must be closed while its shortcut list is written; the
# script offers to close it. On a Steam Deck run it from Desktop Mode, then go back to Game Mode.
set -euo pipefail

REPO="quincarter/marvel-champions-digital-game"
# The release staging step (scripts/stage-release-assets.mjs) stamps the release's tag here, so a script downloaded
# from a release fetches that release's art. A copy run from the repo uses main's.
ART_REF="__MC_RELEASE_TAG__"
case "$ART_REF" in __*) ART_REF="main" ;; esac

# The shortcut's name: what Steam, Big Picture and status plugins (Discord via Decky) show.
APP_NAME="Marvel Champions Digital Edition"
INSTALL_DIR="$HOME/Applications/MarvelChampions"
INSTALLED="$INSTALL_DIR/MarvelChampions.AppImage"
ART_FILES=(icon.png portrait.jpg wide.jpg hero.jpg logo.png)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

force_download=0
assume_yes=0
uninstall=0
appimage=""

usage() { sed -n '2,/^set -euo/p' "${BASH_SOURCE[0]}" | sed '$d; s/^# \{0,1\}//'; }
say() { printf '%s\n' "$*"; }
die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --download) force_download=1 ;;
    --yes | -y) assume_yes=1 ;;
    --uninstall) uninstall=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*) die "unknown option $1 (see --help)" ;;
    *) appimage="$1" ;;
  esac
  shift
done

[ "$(uname -s)" = "Linux" ] || die "this script is for Linux; on Windows and macOS use the installer from the release."
command -v python3 > /dev/null || die "python3 is needed to edit Steam's shortcut list. Install it with your package manager (Arch: sudo pacman -S python) and run this again."

# --- The system ------------------------------------------------------------------------------------------------------

os_id="linux"
os_like=""
os_name="Linux"
if [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  os_id="$(. /etc/os-release && printf '%s' "${ID:-linux}")"
  os_like="$(. /etc/os-release && printf '%s' "${ID_LIKE:-}")"
  os_name="$(. /etc/os-release && printf '%s' "${PRETTY_NAME:-${NAME:-Linux}}")"
fi
board="$(cat /sys/devices/virtual/dmi/id/board_name 2> /dev/null || true)"
steam_deck=0
case "$board" in Jupiter | Galileo) steam_deck=1 ;; esac
# Image-based systems keep /usr read-only, so the script never suggests installing a package there.
immutable=0
case "$os_id" in steamos | bazzite | bluefin | aurora | silverblue | kinoite | nixos) immutable=1 ;; esac
[ -e /run/ostree-booted ] && immutable=1

say "System: $os_name$([ "$steam_deck" = 1 ] && printf ' (Steam Deck)')"

# --- Steam -----------------------------------------------------------------------------------------------------------

native_steam=""
for dir in "$HOME/.local/share/Steam" "$HOME/.steam/steam" "$HOME/.steam/root"; do
  if [ -d "$dir/userdata" ]; then
    native_steam="$(cd "$dir" && pwd -P)"
    break
  fi
done
flatpak_steam="$HOME/.var/app/com.valvesoftware.Steam/.local/share/Steam"
[ -d "$flatpak_steam/userdata" ] || flatpak_steam=""

if [ -n "$native_steam" ]; then
  steam_root="$native_steam"
  steam_kind="native"
elif [ -n "$flatpak_steam" ]; then
  steam_root="$flatpak_steam"
  steam_kind="flatpak"
else
  die "no Steam install with a signed-in user was found (looked in ~/.local/share/Steam, ~/.steam and the Flatpak's folder). Start Steam and sign in once, then run this again."
fi
say "Steam: $steam_kind, $steam_root"

users=()
for dir in "$steam_root"/userdata/*/; do
  id="$(basename "$dir")"
  case "$id" in '' | 0 | *[!0-9]*) continue ;; esac
  users+=("$id")
done
[ "${#users[@]}" -gt 0 ] || die "Steam has no signed-in user yet. Start Steam and sign in once, then run this again."

steam_running() { pgrep -x steam > /dev/null 2>&1 || pgrep -f 'steamwebhelper' > /dev/null 2>&1; }

if steam_running; then
  if [ "$assume_yes" = 0 ]; then
    [ -t 0 ] || die "Steam is running. Close it (Steam > Exit) and run this again, or pass --yes to have it closed."
    printf 'Steam is running and would overwrite the change when it exits. Close Steam now? [Y/n] '
    read -r answer
    case "$answer" in [nN]*) die "Steam is still running. Close it and run this again." ;; esac
  fi
  say "Closing Steam..."
  if [ "$steam_kind" = flatpak ]; then
    flatpak run com.valvesoftware.Steam -shutdown > /dev/null 2>&1 || true
  else
    steam -shutdown > /dev/null 2>&1 || true
  fi
  for _ in $(seq 1 60); do
    steam_running || break
    sleep 1
  done
  steam_running && die "Steam didn't close within a minute. Exit it from its menu and run this again."
fi

# --- Uninstall -------------------------------------------------------------------------------------------------------

# The Python half: reads and writes Steam's binary shortcuts.vdf, and works out the shortcut's id the way Steam does,
# which names its art in the grid folder. Arguments: <command> <shortcuts.vdf> <exe> <name> [start dir] [icon]
# [launch options] [variables to drop]. "add" prints, tab-separated, the shortcut's grid id, the launch options it
# wrote (the given ones, plus what the earlier entry had that the script doesn't manage: a player's own additions) and
# the grid ids of the other entries for this game it replaced. "remove" prints the grid ids of the entries it took out.
vdf_tool() {
  python3 - "$@" << 'PY'
import os, re, struct, sys, zlib

cmd, path, exe, name = sys.argv[1:5]
rest = sys.argv[5:]

def read_map(data, i):
    out = {}
    while True:
        t = data[i]; i += 1
        if t == 0x08:
            return out, i
        end = data.index(b"\0", i); key = data[i:end].decode("utf-8", "replace"); i = end + 1
        if t == 0x00:
            out[key], i = read_map(data, i)
        elif t == 0x01:
            end = data.index(b"\0", i); out[key] = data[i:end].decode("utf-8", "replace"); i = end + 1
        elif t == 0x02:
            out[key] = struct.unpack_from("<i", data, i)[0]; i += 4
        elif t == 0x07:
            out[key] = ("u64", struct.unpack_from("<Q", data, i)[0]); i += 8
        else:
            raise ValueError(f"unknown field type {t:#x} in {path}")

def write_map(m):
    out = bytearray()
    for key, value in m.items():
        k = key.encode() + b"\0"
        if isinstance(value, dict):
            out += b"\x00" + k + write_map(value)
        elif isinstance(value, tuple):
            out += b"\x07" + k + struct.pack("<Q", value[1])
        elif isinstance(value, int):
            out += b"\x02" + k + struct.pack("<i", value)
        else:
            out += b"\x01" + k + str(value).encode() + b"\0"
    return out + b"\x08"

shortcuts = {}
if os.path.exists(path) and os.path.getsize(path) > 0:
    with open(path, "rb") as f:
        data = f.read()
    root, _ = read_map(data, 0)
    shortcuts = root.get("shortcuts", {})

quoted = f'"{exe}"'
# Steam's id for a non-Steam shortcut: the CRC-32 of its target and name with the top bit set. The grid art is named
# by it, unsigned; shortcuts.vdf stores it as a signed 32-bit number.
grid_id = (zlib.crc32((quoted + name).encode()) & 0xFFFFFFFF) | 0x80000000
signed_id = grid_id - (1 << 32)

# This game's entry under any name it has had: this script's, its first draft's ("Marvel Champions"), or one added by
# hand, which Steam names after the AppImage file (Marvel-Champions-PR401-...-x86_64.AppImage).
appimage = re.compile(r"(?i)^marvel-?champions.*\.appimage$")

def ours(entry):
    exe = entry.get("Exe") or entry.get("exe") or ""
    app = entry.get("AppName") or entry.get("appname") or ""
    if exe == quoted or app in (name, "Marvel Champions"):
        return True
    return bool(appimage.match(os.path.basename(exe.strip('"'))) or appimage.match(app))

kept = [e for e in shortcuts.values() if not ours(e)]
previous = next((e for e in shortcuts.values() if ours(e)), None)

launch = ""
if cmd == "add":
    start_dir, icon, launch, drop = rest
    if previous:
        before, sep, after = previous.get("LaunchOptions", "").partition("%command%")
        key = lambda t: t.split("=", 1)[0]
        dropped = set(drop.split())
        old = {key(t): t for t in before.split() if key(t) not in dropped and t not in dropped}
        given = [old.pop(key(t), t) for t in launch.split("%command%")[0].split()]
        launch = " ".join(given + list(old.values()) + ["%command%"]) + (after if sep else "")
    entry = {
        "appid": signed_id,
        "AppName": name,
        "Exe": quoted,
        "StartDir": f'"{start_dir}"',
        "icon": icon,
        "ShortcutPath": "",
        "LaunchOptions": launch,
        "IsHidden": 0,
        "AllowDesktopConfig": 1,
        "AllowOverlay": 1,
        "OpenVR": 0,
        "Devkit": 0,
        "DevkitGameID": "",
        "DevkitOverrideAppID": 0,
        "LastPlayTime": previous.get("LastPlayTime", 0) if previous else 0,
        "FlatpakAppID": "",
        "tags": previous.get("tags", {}) if previous else {},
    }
    kept.append(entry)

if cmd == "add" or previous is not None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        with open(path, "rb") as f, open(path + ".bak", "wb") as b:
            b.write(f.read())
    body = b"\x00shortcuts\0" + write_map({str(i): e for i, e in enumerate(kept)}) + b"\x08"
    tmp = path + ".tmp"
    with open(tmp, "wb") as f:
        f.write(body)
    os.replace(tmp, path)

# The grid ids of every entry taken out, to delete their art (an entry under another name has its art under another
# id).
removed = {e["appid"] & 0xFFFFFFFF for e in shortcuts.values() if ours(e) and "appid" in e} - {grid_id}
if cmd == "add":
    print(grid_id, launch, " ".join(map(str, removed)), sep="\t")
else:
    print(" ".join(str(i) for i in removed | {grid_id}))
PY
}

if [ "$uninstall" = 1 ]; then
  for user in "${users[@]}"; do
    config="$steam_root/userdata/$user/config"
    [ -f "$config/shortcuts.vdf" ] || continue
    for id in $(vdf_tool remove "$config/shortcuts.vdf" "$INSTALLED" "$APP_NAME"); do
      rm -f "$config/grid/${id}p.jpg" "$config/grid/${id}.jpg" "$config/grid/${id}_hero.jpg" \
        "$config/grid/${id}_logo.png" "$config/grid/${id}_icon.png"
    done
  done
  rm -rf "$INSTALL_DIR"
  say "Removed $APP_NAME from Steam and deleted $INSTALL_DIR. Start Steam again to see the change."
  exit 0
fi

# --- The AppImage ----------------------------------------------------------------------------------------------------

newest_appimage() {
  # The newest release AppImage in a folder, by version (MarvelChampions-<version>-Linux-x64.AppImage).
  # A missing folder (no ~/Downloads, or a localized one) is just no AppImage, so the download fallback still runs.
  [ -d "$1" ] || return 0
  find "$1" -maxdepth 1 -type f -name 'MarvelChampions-*-Linux-*.AppImage' 2> /dev/null | sort -V | tail -n 1 || true
}

if [ -z "$appimage" ] && [ "$force_download" = 0 ]; then
  appimage="$(newest_appimage "$SCRIPT_DIR")"
  [ -n "$appimage" ] || appimage="$(newest_appimage "$HOME/Downloads")"
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

if [ -z "$appimage" ]; then
  command -v curl > /dev/null || die "no AppImage found next to this script or in ~/Downloads, and curl isn't installed to download one."
  say "Looking up the latest release..."
  url="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | python3 -c '
import json, sys
assets = json.load(sys.stdin).get("assets", [])
print(next((a["browser_download_url"] for a in assets if a["name"].endswith(".AppImage")), ""))
')" || die "couldn't reach GitHub to find the latest release."
  [ -n "$url" ] || die "the latest release has no AppImage."
  say "Downloading $(basename "$url")..."
  curl -fL --progress-bar -o "$tmp_dir/download.AppImage" "$url" || die "the download failed."
  appimage="$tmp_dir/download.AppImage"
fi

[ -f "$appimage" ] || die "$appimage doesn't exist."
appimage="$(cd "$(dirname "$appimage")" && pwd)/$(basename "$appimage")"
mkdir -p "$INSTALL_DIR"
if [ "$appimage" != "$INSTALLED" ]; then
  say "Installing $(basename "$appimage") to $INSTALLED"
  cp -f "$appimage" "$INSTALLED.new"
  mv -f "$INSTALLED.new" "$INSTALLED"
fi
chmod +x "$INSTALLED"

# --- The art ---------------------------------------------------------------------------------------------------------

art_dir="$SCRIPT_DIR/steam-art"
for file in "${ART_FILES[@]}"; do
  [ -f "$art_dir/$file" ] && continue
  art_dir="$tmp_dir/art"
  break
done
if [ "$art_dir" = "$tmp_dir/art" ]; then
  mkdir -p "$art_dir"
  if command -v curl > /dev/null; then
    say "Downloading the library art..."
    for file in "${ART_FILES[@]}"; do
      curl -fsSL -o "$art_dir/$file" "https://raw.githubusercontent.com/$REPO/$ART_REF/scripts/linux/steam-art/$file" ||
        rm -f "$art_dir/$file"
    done
  fi
fi
# The icon also lives beside the game, so the shortcut keeps it even if Steam's grid folder is cleared.
[ -f "$art_dir/icon.png" ] && cp -f "$art_dir/icon.png" "$INSTALL_DIR/icon.png"

# --- Launch options --------------------------------------------------------------------------------------------------

# The app sets the WebKitGTK and audio variables it needs itself (src-tauri/src/main.rs), so the entry only gets what
# this system needs to run an AppImage at all.
options=()
# Variables the script decides each run, so an earlier run's value doesn't linger in the entry, and what its drafts
# set while #401 chased the Bazzite freeze (none of it stopped the freeze): a variable, or one exact setting of it so a
# player's own value stays.
drop="APPIMAGE_EXTRACT_AND_RUN NO_AT_BRIDGE WEBKIT_DISABLE_COMPOSITING_MODE GDK_BACKEND=x11 PULSE_LATENCY_MSEC=90"
drop="$drop WEBKIT_DISABLE_DMABUF_RENDERER=1"

# An AppImage mounts itself with FUSE 2. Without libfuse2 (newer Ubuntu and Debian, Flatpak Steam's sandbox) it can
# still run by unpacking itself to /tmp at each launch, which is a few seconds slower.
fuse_ok=0
if [ -e /dev/fuse ]; then
  if { PATH="$PATH:/sbin:/usr/sbin" ldconfig -p 2> /dev/null || true; } | grep -q 'libfuse\.so\.2'; then
    fuse_ok=1
  else
    for lib in /usr/lib*/libfuse.so.2* /usr/lib/*/libfuse.so.2* /lib*/libfuse.so.2* /lib/*/libfuse.so.2*; do
      if [ -e "$lib" ]; then
        fuse_ok=1
        break
      fi
    done
  fi
fi
if [ "$steam_kind" = flatpak ] || [ "$fuse_ok" = 0 ]; then
  options+=(APPIMAGE_EXTRACT_AND_RUN=1)
fi
launch="${options[*]:+${options[*]} }%command%"

if [ "$steam_kind" = flatpak ]; then
  # Flatpak Steam can only see the folders it is given.
  flatpak override --user --filesystem="$INSTALL_DIR" com.valvesoftware.Steam > /dev/null 2>&1 ||
    say "Couldn't give Flatpak Steam access to $INSTALL_DIR; run: flatpak override --user --filesystem=$INSTALL_DIR com.valvesoftware.Steam"
fi

# --- The Steam entry -------------------------------------------------------------------------------------------------

for user in "${users[@]}"; do
  config="$steam_root/userdata/$user/config"
  icon=""
  [ -f "$INSTALL_DIR/icon.png" ] && icon="$INSTALL_DIR/icon.png"
  result="$(vdf_tool add "$config/shortcuts.vdf" "$INSTALLED" "$APP_NAME" "$INSTALL_DIR" "$icon" "$launch" "$drop")"
  IFS=$'\t' read -r id written replaced <<< "$result"
  grid="$config/grid"
  mkdir -p "$grid"
  for old in $replaced; do
    rm -f "$grid/${old}p.jpg" "$grid/${old}.jpg" "$grid/${old}_hero.jpg" "$grid/${old}_logo.png" "$grid/${old}_icon.png"
  done
  # Steam's names for a shortcut's library art: <id>p portrait, <id> wide, <id>_hero, <id>_logo, <id>_icon.
  [ -f "$art_dir/portrait.jpg" ] && cp -f "$art_dir/portrait.jpg" "$grid/${id}p.jpg"
  [ -f "$art_dir/wide.jpg" ] && cp -f "$art_dir/wide.jpg" "$grid/${id}.jpg"
  [ -f "$art_dir/hero.jpg" ] && cp -f "$art_dir/hero.jpg" "$grid/${id}_hero.jpg"
  [ -f "$art_dir/logo.png" ] && cp -f "$art_dir/logo.png" "$grid/${id}_logo.png"
  [ -f "$art_dir/icon.png" ] && cp -f "$art_dir/icon.png" "$grid/${id}_icon.png"
  say "Added $APP_NAME to Steam user $user. Launch options: $written"
done

say ""
if [ "$fuse_ok" = 0 ] && [ "$steam_kind" = native ]; then
  say "libfuse2 isn't installed, so the game unpacks itself at each launch (a few seconds slower)."
  if [ "$immutable" = 0 ]; then
    case " $os_id $os_like " in
      *" ubuntu "* | *" debian "*) say "To launch it faster: sudo apt install libfuse2t64 (or libfuse2 on older releases), then run this again." ;;
      *" fedora "* | *" rhel "*) say "To launch it faster: sudo dnf install fuse-libs, then run this again." ;;
      *" arch "*) say "To launch it faster: sudo pacman -S fuse2, then run this again." ;;
      *" opensuse"* | *" suse "*) say "To launch it faster: sudo zypper install libfuse2, then run this again." ;;
    esac
  fi
fi
if [ "$steam_deck" = 1 ]; then
  say "Done. Go back to Game Mode: $APP_NAME is in your library under Non-Steam."
else
  say "Done. Start Steam: $APP_NAME is in your library."
fi
