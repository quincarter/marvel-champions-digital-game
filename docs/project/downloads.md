# Downloads

[README](../../README.md) · [Current status](current-status.md) · [Architecture](architecture.md) · [Downloads](downloads.md) · [Contributing](../../CONTRIBUTING.md)

Every merge of a release pull request publishes a
[GitHub release](https://github.com/quincarter/marvel-champions-digital-game/releases/latest) with installers. Each
release's notes end with a "Which download do I need?" table. Each installer is also uploaded without the version in its name
(`MarvelChampions-Windows-x64-Setup.exe` and so on), so
`https://github.com/quincarter/marvel-champions-digital-game/releases/latest/download/<name>` always fetches the newest
one; the buttons at the top of the README link there.

- **Windows 11**: `-Windows-x64-Setup.exe` (per user, no admin rights) or `-Windows-x64-AllUsers.msi`.
- **macOS**: `-macOS-AppleSilicon-arm64.dmg` or `-macOS-Intel-x64.dmg`. If the build is unsigned, macOS blocks it on
  first launch: allow it in System Settings → Privacy & Security → Open Anyway, or run
  `xattr -dr com.apple.quarantine "/Applications/Marvel Champions.app"`.
- **Linux**: `.deb`, `.rpm` or `.AppImage` (x64).
- **Android**: `-Android.apk`.

The desktop and Android apps check GitHub for a newer release on launch and show an "Update available" banner on the
Title screen when one exists. The web app always runs the latest version.
