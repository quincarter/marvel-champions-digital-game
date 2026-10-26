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

Each release has an "Install for Steam" script for Windows, macOS and Linux. It adds the installed game to Steam as a
non-Steam game, with its icon and library art (the grid, wide and Big Picture banners), so it plays from your library
and Big Picture with a controller. Running it again updates the entry instead of adding a second one, and keeps its
collections and play time. Steam has to be closed while it runs; the script offers to close it.

- **Windows**: install the game, then download `-Windows-Install-for-Steam.ps1` and run, in PowerShell (`-File`
  takes no wildcards, so this looks the file up first):
  `powershell -ExecutionPolicy Bypass -File (Get-ChildItem ~\Downloads\MarvelChampions-*-Windows-Install-for-Steam.ps1 | Select-Object -Last 1).FullName`
- **macOS**: drag the game into Applications from the `.dmg`, then download `-macOS-Install-for-Steam.sh` and run
  `bash ~/Downloads/MarvelChampions-*-macOS-Install-for-Steam.sh`.
- **Linux, Steam Deck and Bazzite**: download the `.AppImage` and `-Linux-Install-for-Steam.sh` (on a Steam Deck, in
  Desktop Mode), then run `bash ~/Downloads/MarvelChampions-*-Linux-Install-for-Steam.sh`. It takes the newest
  AppImage from Downloads (or downloads the latest), installs it to `~/Applications/MarvelChampions/`, works with
  native and Flatpak Steam on any distro (without libfuse2 it adds `APPIMAGE_EXTRACT_AND_RUN=1` to the launch
  options so the AppImage still starts). The app sets the [launch options](#linux-launch-options) below itself, so the
  entry doesn't need them. Launch options you add in Steam yourself are kept when you run it again for a new version.

Every script takes `--help` (`-?` on Windows) and an uninstall option (`--uninstall`, or `-Uninstall` on Windows) that
removes the Steam entry and its art. The scripts live in `scripts/linux/`, `scripts/macos/` and `scripts/windows/`;
the art is in `scripts/linux/steam-art/`, built by `scripts/linux/make-steam-art.py` from the title screen pictures.

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
