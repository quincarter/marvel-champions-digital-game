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

## Linux launch options

The Linux app runs on WebKitGTK, and a few environment variables change how it behaves. The app sets the first two
itself when it starts, and only when you haven't set them, so a value of your own always wins.

| Variable                            | Set by the app                | What it does                                                                                                  |
| ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `PULSE_LATENCY_MSEC=90`             | Always on Linux               | A longer audio buffer, so sound doesn't crackle under PipeWire (Steam Deck, Bazzite).                         |
| `WEBKIT_DISABLE_DMABUF_RENDERER=1`  | Always on Linux               | Turns off WebKit's DMA-BUF renderer, which drew corrupt or blank card textures on the Steam Deck and Bazzite. |
| `WEBKIT_DISABLE_COMPOSITING_MODE=1` | No: set it yourself if needed | Turns off WebKit's GPU compositing. Try it if the game flickers or draws wrongly on your GPU.                 |
| `G_MESSAGES_DEBUG=all`              | No: for reporting a problem   | Prints GTK and WebKit debug messages to the terminal.                                                         |

To run the AppImage with an option, put it in front of the command in a terminal, for example:

```bash
chmod +x MarvelChampions-*-Linux-x64.AppImage
WEBKIT_DISABLE_COMPOSITING_MODE=1 ./MarvelChampions-*-Linux-x64.AppImage
```

Added to Steam as a non-Steam game (the way to play on a Steam Deck), set it in the game's Properties → Launch Options:
`WEBKIT_DISABLE_COMPOSITING_MODE=1 %command%`.

**Reporting a freeze or crash on Linux:** run the game from a terminal with its output saved, then attach `mc-log.txt`
to the issue. The last lines before the problem matter most.

```bash
G_MESSAGES_DEBUG=all ./MarvelChampions-*-Linux-x64.AppImage 2>&1 | tee ~/mc-log.txt
```

`RUST_LOG` does nothing in the released app. Errors from the controller bridge and the audio engine print to the
terminal without it.
