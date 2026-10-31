# Downloads

[README](../../README.md) · [Current status](current-status.md) · [Architecture](architecture.md) · [Downloads](downloads.md) · [Contributing](../../CONTRIBUTING.md)

Every merge of a release pull request publishes a
[GitHub release](https://github.com/quincarter/marvel-champions-digital-game/releases/latest) with installers. Each
release's notes end with a "Which download do I need?" table. The download buttons at the top of the README show the
latest version and link straight to its installers; every release PR updates them.

- **Windows 11**: `-Windows-x64-Setup.exe` (per user, no admin rights) or `-Windows-x64-AllUsers.msi`.
- **macOS**: `-macOS-AppleSilicon-arm64.dmg` or `-macOS-Intel-x64.dmg`. If the build is unsigned, macOS blocks it on
  first launch: allow it in System Settings → Privacy & Security → Open Anyway, or run
  `xattr -dr com.apple.quarantine "/Applications/Marvel Champions.app"`.
- **Linux**: `.deb`, `.rpm` or `.AppImage` (x64). See [Linux launch options](#linux-launch-options) for the
  environment variables the app sets and how to add your own.
- **Android**: `-Android.apk`.

The desktop and Android apps check GitHub for a newer release on launch and show an "Update available" banner on the
Title screen when one exists. The web app always runs the latest version.

## Play it from Steam

There is one "Install for Steam" script for each system, and it never changes from release to release: it asks GitHub
for the latest release itself, so the links below always work and an old copy still installs the newest game. It
installs or updates the game, then adds it to Steam as a non-Steam game, with its icon and library art (the grid, wide
and Big Picture banners), so it plays from your library and Big Picture with a controller. The entry is named "Marvel
Champions Digital Edition", which is what Steam and status plugins such as Discord show. Running it again updates the
game and the entry instead of adding a second one, keeps its collections and play time, and also replaces an entry you
added by hand (named after the AppImage or exe file). Steam has to be closed while it runs; the script offers to close
it.

- **Windows**: download
  [`MarvelChampions-Windows-Install-for-Steam.cmd`](https://github.com/quincarter/marvel-champions-digital-game/releases/latest/download/MarvelChampions-Windows-Install-for-Steam.cmd)
  and double-click it. Windows may ask first because the file came from the internet: choose **Run** (or **More
  info**, then **Run anyway**). It needs no execution policy change: the `.cmd` carries the PowerShell script and runs
  it as text, because Windows won't run a downloaded, unsigned `.ps1` under its default policy (#474). The window stays
  open at the end so you can read it. From a terminal it takes the same options, e.g.
  `.\MarvelChampions-Windows-Install-for-Steam.cmd -Uninstall`.
- **macOS**: download
  [`MarvelChampions-macOS-Install-for-Steam.sh`](https://github.com/quincarter/marvel-champions-digital-game/releases/latest/download/MarvelChampions-macOS-Install-for-Steam.sh)
  and run `bash ~/Downloads/MarvelChampions-macOS-Install-for-Steam.sh`.
- **Linux, Steam Deck and Bazzite**: on a Steam Deck, do this in Desktop Mode. Download
  [`MarvelChampions-Linux-Install-for-Steam.tar.gz`](https://github.com/quincarter/marvel-champions-digital-game/releases/latest/download/MarvelChampions-Linux-Install-for-Steam.tar.gz),
  extract it, and run `install-for-steam.sh` from the folder; it is already executable, and the art is beside it. Or
  in one line in a terminal:

  ```bash
  curl -fsSL https://github.com/quincarter/marvel-champions-digital-game/releases/latest/download/MarvelChampions-Linux-Install-for-Steam.sh | bash
  ```

  It installs to `~/Applications/MarvelChampions/`, and works with native and Flatpak Steam on any distro (without
  libfuse2 it adds `APPIMAGE_EXTRACT_AND_RUN=1` to the launch options so the AppImage still starts). An AppImage of the
  latest version next to the script or in Downloads is used instead of downloading it again, and one you name on the
  command line is used whatever its version. The app sets the [launch options](#linux-launch-options) below itself, so
  the entry doesn't need them. Launch options you add in Steam yourself are kept when you run it again.

Every script takes `--help` (`-?` on Windows), `--language es` (`-Language es`) for the Spanish cards, and an uninstall
option (`--uninstall`, or `-Uninstall` on Windows) that removes the Steam entry and its art. The scripts live in
`scripts/linux/`, `scripts/macos/` and `scripts/windows/`; the art is in `scripts/linux/steam-art/`, built by
`scripts/linux/make-steam-art.py` from the title screen pictures.

### Updating from inside the game

Each run records the install in a hidden folder in your home directory, `~/.marvel-champions/` (on Windows,
`C:\Users\<you>\.marvel-champions\`): `install.json` and a copy of the script. The game reads that record and shows
"Steam script" beside its version on the Title screen. If you installed with an earlier version of the script, run the
new one once to get this.

When a new release is out, the Title's update banner has an **Update** button instead of a download. It runs the saved
script with its progress on screen, so it works in Game Mode on a Steam Deck, where there is no terminal. Once the
download is done, quit the game to install it, then start the game again from Steam. You can keep playing first: it
installs whenever you quit. Settings → More → Steam install runs the same check at any time. If an update fails, its
output is in `update.log` in the same folder.

An install from the MSI on Windows asks for administrator rights when it installs.

## Linux launch options

The Linux app runs on WebKitGTK, and a few environment variables change how it behaves. The app sets the first three
itself when it starts, and only when you haven't set them, so a value of your own always wins.

| Variable                            | Set by the app                | What it does                                                                                                                                                                                                 |
| ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PULSE_LATENCY_MSEC=90`             | Always on Linux               | A longer audio buffer, so sound doesn't crackle under PipeWire (Steam Deck, Bazzite).                                                                                                                        |
| `WEBKIT_DISABLE_DMABUF_RENDERER=1`  | Always on Linux               | Turns off WebKit's DMA-BUF renderer, which drew corrupt or blank card textures on the Steam Deck and Bazzite.                                                                                                |
| `GDK_BACKEND=x11,wayland`           | Always on Linux               | Runs the window through X11 (XWayland on a Wayland desktop), falling back to Wayland where there is no X11: under Wayland the page could freeze when the screen slept. Set `GDK_BACKEND=wayland` to go back. |
| `WEBKIT_DISABLE_COMPOSITING_MODE=1` | No: set it yourself if needed | Turns off WebKit's GPU compositing. Try it if the game flickers or draws wrongly on your GPU.                                                                                                                |
| `G_MESSAGES_DEBUG=all`              | No: for reporting a problem   | Prints GTK and WebKit debug messages to the terminal.                                                                                                                                                        |

To run the AppImage with an option, put it in front of the command in a terminal, for example:

```bash
chmod +x MarvelChampions-*-Linux-x64.AppImage
WEBKIT_DISABLE_COMPOSITING_MODE=1 ./MarvelChampions-*-Linux-x64.AppImage
```

Added to Steam as a non-Steam game (the way to play on a Steam Deck), set it in the game's Properties → Launch Options:
`WEBKIT_DISABLE_COMPOSITING_MODE=1 %command%`.

**If the game freezes for good** (nothing redraws and no input works, often after the display slept or the TV went off
and on), the app restarts WebKit's stuck page process and reloads the game once the page has been unresponsive for 10
seconds while its window is focused, and prints a `hang watchdog:` line to the terminal; your game in progress is
under Continue on the Title screen. `MC_DISABLE_HANG_WATCHDOG=1` turns this off.

**Reporting a freeze or crash on Linux:** run the game from a terminal with its output saved, then attach `mc-log.txt`
to the issue. The last lines before the problem matter most.

```bash
G_MESSAGES_DEBUG=all ./MarvelChampions-*-Linux-x64.AppImage 2>&1 | tee ~/mc-log.txt
```

`RUST_LOG` does nothing in the released app. Errors from the controller bridge and the audio engine print to the
terminal without it.
