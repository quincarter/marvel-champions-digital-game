## Mods, Front and Center

The Mod Store moves onto the main menu, with everything @bluefireF5ran asked for after playing it (#734): a storefront button on the title screen, Extras and Credits tabs, a search box with tag chips and a sort, and settings that put mods beside the official heroes and scenarios and choose whether they start unlocked. Creators get three new optional pack.json fields, tags, wave and unlock, and the store's packs now publish from the mods registry with their ids and versions intact. On Android, the store opens again and packs install again, after @zackburnley's report (#733). Thank you!

**[Read the full v0.46.0 report on the site ↗](https://champions-digital-game.com/releases/v0.46.0/)**: the Mod Store on the main menu, search, tags and Credits, the custom content settings, the Android fixes and the thank-you wall.

**[Lee el informe completo en español ↗](https://champions-digital-game.com/releases/v0.46.0/index.es.html)**

![The numbers: 5 playtest notes from @bluefireF5ran, 6 store tabs and 2 Android fixes](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/684227d645524977e710a9f8ba70ac808743def0/docs/screenshots/releases/v0.46.0/v0-46-0-release-01-the-numbers.jpg)

![The Mod Store moves up front: the store's tabs, search and sort, the menu entry, search on a phone, Credits, a creator's packs, and the two custom content settings](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/684227d645524977e710a9f8ba70ac808743def0/docs/screenshots/releases/v0.46.0/v0-46-0-release-02-the-mod-store-moves-up-front.jpg)

![You asked, we fixed: the store opening and packs installing on Android, reported by @zackburnley](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/684227d645524977e710a9f8ba70ac808743def0/docs/screenshots/releases/v0.46.0/v0-46-0-release-03-you-asked-we-fixed.jpg)

![Also in v0.46.0: the community packs publish from the mods registry, and the mod SDK publishes to npm through trusted publishing](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/684227d645524977e710a9f8ba70ac808743def0/docs/screenshots/releases/v0.46.0/v0-46-0-release-04-also-in-v0-46-0.jpg)

![Thank you to bluefireF5ran, zackburnley and the pack creators](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/684227d645524977e710a9f8ba70ac808743def0/docs/screenshots/releases/v0.46.0/v0-46-0-release-05-thank-you.jpg)

![Code shipped since v0.45.0](https://raw.githubusercontent.com/quincarter/marvel-champions-digital-game/684227d645524977e710a9f8ba70ac808743def0/docs/screenshots/releases/v0.46.0/v0-46-0-release-06-code-shipped.jpg)

---

## [v0.46.0] - 2026-11-16

### Added

- The v0.46.0 release report has its own page on the site, at /releases/v0.46.0/

### Changed

- The mod SDK publishes to npm through npm trusted publishing instead of an npm token
- The community content packs (Carnage, Gwenpool, Mephisto, Night Thrasher, The Punisher, Yondu, Lost Traits, GMW Fixes and the Throg draft) moved to the Mod Store registry repo, which publishes them now; the game repo fetches them for its tests with pnpm packs:fetch.

### Fixed

- The Mod Store no longer locks up on Android phones the first time it opens: the notice's round portraits of Deadpool and Spider-Man are baked as discs instead of drawn through a circular mask, which stopped the game drawing after Deadpool's line (#733). The Team-Up info portraits get the same fix.
- Mod Store installs work on Android again: the download size check counted the line breaks in Android's base64 body as data, so every pack looked about 1% larger than its catalog size and was refused.
- The e2e spec for PageDown on Take your seats presses RB again when the first press lands in the frames the pad guard drops, instead of failing under a loaded suite.

### Docs

- The v0.45.0 release notes in Spanish carry the twelve changelog lines that landed after they were written

### Special thanks

- @zackburnley reported #733.
