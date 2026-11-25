<div align="center">

<img src="packages/client/src-tauri/icons/128x128@2x.png" alt="Marvel Champions: Digital Edition logo" width="128">

# Marvel Champions: Digital Edition (Unofficial Fan Game)

[![Latest release](https://img.shields.io/badge/version-v1.0.0-e8730c)](https://github.com/quincarter/marvel-champions-digital-game/releases/tag/v1.0.0)
[![Tests and build on main](https://img.shields.io/github/actions/workflow/status/quincarter/marvel-champions-digital-game/netlify-deploy.yml?branch=main&event=push&label=tests%20%26%20build&logo=github)](https://github.com/quincarter/marvel-champions-digital-game/actions/workflows/netlify-deploy.yml?query=branch%3Amain)
[![Release](https://github.com/quincarter/marvel-champions-digital-game/actions/workflows/release-on-merge.yml/badge.svg?branch=main)](https://github.com/quincarter/marvel-champions-digital-game/actions/workflows/release-on-merge.yml?query=branch%3Amain)
[![Netlify Status](https://api.netlify.com/api/v1/badges/487c224e-254f-42a0-a2b3-a6192b9e70c8/deploy-status)](https://app.netlify.com/projects/marvel-champions-digital-game/deploys)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue)](LICENSE)

</div>

A digital, rules-accurate implementation of **Marvel Champions: The Card Game** (Fantasy Flight Games / Marvel), built
to be a genuinely playable video game driven by a deterministic rules engine.

<p align="center">
  <a href="https://marvel.champions-digital-game.com/"><img src=".github/assets/readme/play-in-browser.svg" alt="Play in your browser" height="48"></a>
</p>

<p align="center">
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases/download/v1.0.0/MarvelChampions-1.0.0-EN-Windows-x64-Setup.exe"><img src=".github/assets/readme/download-windows.svg" alt="Download for Windows" height="48"></a>
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases/download/v1.0.0/MarvelChampions-1.0.0-EN-macOS-AppleSilicon-arm64.dmg"><img src=".github/assets/readme/download-macos-apple-silicon.svg" alt="Download for a Mac with Apple silicon" height="48"></a>
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases/download/v1.0.0/MarvelChampions-1.0.0-EN-macOS-Intel-x64.dmg"><img src=".github/assets/readme/download-macos-intel.svg" alt="Download for an Intel Mac" height="48"></a>
</p>

<p align="center">
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases/download/v1.0.0/MarvelChampions-1.0.0-EN-Linux-x64.AppImage"><img src=".github/assets/readme/download-linux.svg" alt="Download for Linux (AppImage)" height="48"></a>
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases/download/v1.0.0/MarvelChampions-1.0.0-EN-Android.apk"><img src=".github/assets/readme/download-android.svg" alt="Download for Android" height="48"></a>
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases/download/v1.0.0/MarvelChampions-1.0.0-EN-iOS-unsigned.ipa"><img src=".github/assets/readme/download-ios.svg" alt="Download for iPhone and iPad (sideload)" height="48"></a>
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases"><img src=".github/assets/readme/all-releases.svg" alt="View all releases" height="48"></a>
</p>

<details>
<summary><h3>Expand for Spanish installs · Descargas en español</h3></summary>

<p align="center">Cards printed in Spanish, from <a href="https://github.com/alaintxu/mc-ocr">alaintxu's mc-ocr</a> scans. Each installer replaces the English app, and your saves carry over.<br>
Cartas en español, con los escaneos de <a href="https://github.com/alaintxu/mc-ocr">mc-ocr</a> de alaintxu. Cada instalador reemplaza la versión en inglés y conserva tus partidas guardadas.</p>

<p align="center">
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases/download/v1.0.0/MarvelChampions-1.0.0-ES-Windows-x64-Setup.exe"><img src=".github/assets/readme/download-windows-es.svg" alt="Descargar para Windows (español)" height="48"></a>
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases/download/v1.0.0/MarvelChampions-1.0.0-ES-macOS-AppleSilicon-arm64.dmg"><img src=".github/assets/readme/download-macos-apple-silicon-es.svg" alt="Descargar para Mac con Apple silicon (español)" height="48"></a>
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases/download/v1.0.0/MarvelChampions-1.0.0-ES-macOS-Intel-x64.dmg"><img src=".github/assets/readme/download-macos-intel-es.svg" alt="Descargar para Mac con Intel (español)" height="48"></a>
</p>

<p align="center">
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases/download/v1.0.0/MarvelChampions-1.0.0-ES-Linux-x64.AppImage"><img src=".github/assets/readme/download-linux-es.svg" alt="Descargar para Linux, AppImage (español)" height="48"></a>
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases/download/v1.0.0/MarvelChampions-1.0.0-ES-Android.apk"><img src=".github/assets/readme/download-android-es.svg" alt="Descargar para Android (español)" height="48"></a>
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases/download/v1.0.0/MarvelChampions-1.0.0-ES-iOS-unsigned.ipa"><img src=".github/assets/readme/download-ios-es.svg" alt="Descargar para iPhone y iPad (español, instalación manual)" height="48"></a>
  <a href="https://marvel.champions-digital-game.com/"><img src=".github/assets/readme/play-in-browser-es.svg" alt="Jugar en el navegador" height="48"></a>
</p>

<p align="center"><sub>The web version carries both languages: it starts in your browser's language, and the globe button next to the music button switches it. For the Spanish <code>.msi</code>, <code>.deb</code> or <code>.rpm</code>, look for <code>-ES-</code> in <a href="https://github.com/quincarter/marvel-champions-digital-game/releases">all releases</a>.<br>
For iPhone and iPad, sideload the Spanish <code>.ipa</code> with a free Apple ID: <a href="docs/project/ios-install.md">install guide</a>.<br>
La versión web incluye los dos idiomas: empieza en el idioma de tu navegador y el botón del globo, junto al de la música, lo cambia. Para el <code>.msi</code>, <code>.deb</code> o <code>.rpm</code> en español, busca <code>-ES-</code> en <a href="https://github.com/quincarter/marvel-champions-digital-game/releases">todas las versiones</a>. Para iPhone y iPad, instala el <code>.ipa</code> en español con un Apple ID gratuito: <a href="docs/project/ios-install.es.md">guía de instalación</a>.</sub></p>

</details>

<p align="center">
  <a href="https://github.com/quincarter/marvel-champions-digital-game/issues/new?template=bug_report.yml"><img src=".github/assets/readme/report-a-bug.svg" alt="Report a bug" height="48"></a>
  <a href="https://github.com/quincarter/marvel-champions-digital-game/issues/new?template=feature_request.yml"><img src=".github/assets/readme/request-a-feature.svg" alt="Request a feature" height="48"></a>
  <a href="https://github.com/quincarter/marvel-champions-digital-game/issues/new?template=tested_deck_request.yml"><img src=".github/assets/readme/request-a-deck.svg" alt="Request a tested deck" height="48"></a>
</p>

<p align="center">
  <a href="https://discord.gg/tCy5tqu46j"><img src=".github/assets/readme/discord.svg" alt="Join the Discord" height="48"></a>
  <a href="CONTRIBUTING.md"><img src=".github/assets/readme/contributing.svg" alt="Contributing" height="48"></a>
</p>

<p align="center"><b>iPhone and iPad:</b> the game isn't on the App Store. Download the <code>.ipa</code> above and sideload it with a free Apple ID through SideStore, AltStore or Sideloadly: <a href="docs/project/ios-install.md">step-by-step iOS install guide</a> (<a href="docs/project/ios-install.es.md">en español</a>). Or play in Safari and add it to your Home Screen.</p>

<p align="center"><sub>Each download button names the release it fetches and is updated by every release. For the all-users Windows <code>.msi</code>, a Linux <code>.deb</code> or <code>.rpm</code>, or an older version, see <a href="https://github.com/quincarter/marvel-champions-digital-game/releases">all releases</a>. Not sure which issue type fits? Use the <a href="https://github.com/quincarter/marvel-champions-digital-game/issues/new/choose">issue chooser</a>.</sub></p>

> [!NOTE]
> This is a fan-made, non-commercial project. _Marvel Champions: The Card Game_, card text, artwork, and characters are
> the intellectual property of Fantasy Flight Games and Marvel.

<p align="center">
  <a href="#overview--philosophy">Overview</a> ·
  <a href="#tech-stack">Tech stack</a> ·
  <a href="#community">Community</a> ·
  <a href="#mods">Mods</a> ·
  <a href="#roadmap">Roadmap</a> ·
  <a href="docs/project/current-status.md">Current status</a> ·
  <a href="docs/project/architecture.md">Architecture</a> ·
  <a href="docs/project/downloads.md">Downloads</a> ·
  <a href="CONTRIBUTING.md">Contributing</a> ·
  <a href="#special-thanks">Special thanks</a>
</p>

---

## Overview & philosophy

Marvel Champions is a cooperative Living Card Game (LCG) with an intricate turn structure (Hero Phase ⟷ Villain
Phase), timing windows ("When", "Interrupt", "Response"), card-driven ability stacks, status effects, and dozens of
interacting keywords.

This project is built **rules-engine-first**:

- **Deterministic state machine**: game state is serializable, reproducible from a seed and a command log, and
  decoupled from any presentation or I/O layer.
- **The Rules Reference is the authority**: the official _Rules Reference Guide_ (v1.8, in this repo), FFG's errata and
  its rulings decide how the game behaves. [Rules authority](docs/project/rules-authority.md) gives the order they
  win in when they disagree, and links every RRG version and rulings page.
- **Headless rules engine**: the engine has no DOM or rendering dependencies and can simulate and audit full games on
  its own.
- **Phaser as a pure view**: the client presents state and sends player commands; it never decides rules or move
  legality.

## Tech stack

- **Language**: TypeScript, strict mode in every package
- **Monorepo**: pnpm workspaces (Node.js >= 22)
- **Client**: Phaser 4 + rexUI (`phaser4-rex-plugins`) + Vite; Tauri 2 (desktop) and Capacitor (Android, iOS)
- **Online**: a Cloudflare Worker with Durable Objects for device sync, live game rooms and watching; the Mod Store's packs on Cloudflare R2
- **Mods**: the mod SDK and its `mc-pack` CLI, published to npm as `@champions-digital-game/mod-sdk`
- **Testing**: Vitest unit and scenario suites, Playwright end-to-end suite
- **Lint and format**: oxlint and oxfmt
- **Changelog**: Changie

How the packages fit together, and how to run the game locally, is in [Architecture](docs/project/architecture.md).

## Community

- **Bugs, feature ideas and deck requests:** open an issue from the
  [issue chooser](https://github.com/quincarter/marvel-champions-digital-game/issues/new/choose). In the game, the bug
  icon in the top bar (or on the Title screen) opens Report an issue, which copies the game log for your report.
- **Rules questions:** check the [Rules Reference](docs/rules/mc_rulesreference_v18_compressed.pdf) and
  [FFG's rulings](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/) before filing a rules bug.
- **Discord:** [join the community Discord](https://discord.gg/tCy5tqu46j) to chat about the game, ask questions and share decks. Bugs and
  feature ideas still go to GitHub issues, so they are tracked and credited.
- **Contributing:** see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests, conventions and the release flow.
- **Contributing images and music:** card scans, music and art aren't stored in git; they are zip bundles on
  [marvel-champions-content's releases](https://github.com/quincarter/marvel-champions-content/releases), fetched with
  `pnpm assets:fetch`. To add or replace one, put the file in [`incoming/`](incoming/) at the path it belongs at (for
  example `incoming/music/scenarios/rhino/battle.mp3`) and open a pull request; it is packed into the bundles after the
  merge. Step by step:
  [CONTRIBUTING.md, Contributing images and music](CONTRIBUTING.md#contributing-images-and-music).

## Mods

Community heroes, villains, scenarios, campaigns and house rules install from the **Mod Store** in the game (on the
Title menu). Every pack in it is reviewed and played before it is published, with its creator's permission.

| You want to                       | Start here                                                                                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ask for a mod to be added         | The [Mod request](https://github.com/quincarter/marvel-champions-digital-game/issues/new?template=mod_request.yml) issue form: the mod, its creator, their permission and a download link                                 |
| Make a pack                       | [`marvel-champions-mod-template`](https://github.com/quincarter/marvel-champions-mod-template): make your repo from the template, write cards and abilities with the DSL, and its CI validates, tests and builds the pack |
| Learn the pack format and the DSL | [Custom content packs](docs/custom-content-packs.md) (the design, `pack.json`, the review process) and the [mod SDK README](packages/mod-sdk/README.md) (the source layout and the `mc-pack` CLI)                         |
| Submit or update a pack           | A pull request to the Mod Store registry, [`marvel-champions-mods`](https://github.com/quincarter/marvel-champions-mods), adding or bumping your `packs/<id>.yaml` entry                                                  |
| Report a bug in a pack            | Report a problem on the pack's Mod Store page, or open an issue on the pack's own repository                                                                                                                              |
| Use the SDK in your own tools     | [`@champions-digital-game/mod-sdk`](https://www.npmjs.com/package/@champions-digital-game/mod-sdk) on npm, also attached to every release as a tarball                                                                    |

How the template, the registry and the store fit together is in
[Architecture](docs/project/architecture.md#the-other-repositories-and-how-their-content-gets-in).

## Roadmap

Every released Marvel Champions product, from the Core Set through Shadowland (October 16, 2026), is playable end to
end, alone or online with friends. **v1.0.0** is the release that brings online multiplayer.

| Phase | What it covers                                                                                                | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Foundations: monorepo, card schema, tech stack                                                                | ✅ Done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 1     | Headless rules engine: state machine, turn structure, timing windows, keywords, replayable command log        | ✅ Done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2     | Card content pipeline and the Core Set: MarvelCDB ingestion, the ability DSL, all 233 Core Set cards scripted | ✅ Done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 3     | Encounter and villain AI: villain phase automation, boost, decisions routed to the player the rules name      | ✅ Done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 4     | Client: the Phaser 4 tabletop on desktop, tablet and phone                                                    | ✅ Done, with ongoing improvements                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 5     | Online multiplayer: 2–4 players over a network, reconnects, Epic Multiplayer for Loki                         | ✅ Done in v1.0.0: watch a live game from a link, online rooms with a lobby and chat, players on their own devices, Trickster Takeover Epic Multiplayer, Civil War Competitive and multiplayer achievements ([#876](https://github.com/quincarter/marvel-champions-digital-game/issues/876), [#880](https://github.com/quincarter/marvel-champions-digital-game/issues/880)–[#883](https://github.com/quincarter/marvel-champions-digital-game/issues/883), [#909](https://github.com/quincarter/marvel-champions-digital-game/issues/909)) |
| 6     | Rules QA: ruling-by-ruling tests, replay fixtures, drift detection on new errata                              | 🟡 Ongoing: per-wave rules audits, random-deck soaks, MarvelCDB decklist games, a Rules Reference v1.8 audit                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 7     | Content beyond the Core Set, in release order                                                                 | ✅ Done: every released product through Shadowland (cycle 11); Elektra and Iron Fist wait for their official text                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 8     | Polish: onboarding, settings, audio, packaging, undo                                                          | ✅ Done, with ongoing improvements: Guided mode, settings, music, desktop, Android and iOS builds, self-updating desktop apps, undo and replays                                                                                                                                                                                                                                                                                                                                                                                             |
| 9     | Decks: precons, MarvelCDB import, in-app deck builder                                                         | ✅ Done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 10    | Mods: the Mod Store, the mod SDK and community packs                                                          | ✅ Done, with community packs added in batches                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Next up:

1. **More online play**: keep a room going when its host leaves ([#884](https://github.com/quincarter/marvel-champions-digital-game/issues/884)), find a game from a public list
   ([#885](https://github.com/quincarter/marvel-champions-digital-game/issues/885)), reconnect to your seat from another device ([#886](https://github.com/quincarter/marvel-champions-digital-game/issues/886)), and hidden hands between Civil War
   Competitive teams ([#924](https://github.com/quincarter/marvel-champions-digital-game/issues/924)).
2. **Online play without the cloud**: rooms on a local network ([#956](https://github.com/quincarter/marvel-champions-digital-game/issues/956)) and a room server you can run yourself
   ([#973](https://github.com/quincarter/marvel-champions-digital-game/issues/973)).
3. **Elektra and Iron Fist**, once their official card text is published.
4. **Hero AI** to fill seats with computer-controlled heroes.

What you can play today is in [Current status](docs/project/current-status.md). The detailed plan, decisions and per-wave specs are in [PLAN.md](PLAN.md) and [`docs/`](docs).

---

## More

| Page                                                   | What's in it                                                                                             |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| [Current status](docs/project/current-status.md)       | What you can play today and what the next release adds                                                   |
| [Architecture](docs/project/architecture.md)           | The packages, the other repositories, online rooms, mods, running it locally                             |
| [Downloads](docs/project/downloads.md)                 | Every installer, unsigned macOS builds, Linux launch options, the in-app update notice                   |
| [iPhone and iPad install](docs/project/ios-install.md) | Sideloading the `.ipa` with a free Apple ID, step by step ([en español](docs/project/ios-install.es.md)) |
| [Custom content packs](docs/custom-content-packs.md)   | The Mod Store, the pack format, the DSL, and how a pack is reviewed and published                        |
| [Live game rooms](docs/live-game-rooms.md)             | How watching, rooms, playing together, Epic and Competitive work online                                  |
| [Contributing](CONTRIBUTING.md)                        | Setup, tests, CI, conventions, card data and the release flow                                            |
| [PLAN.md](PLAN.md)                                     | The full roadmap, decisions and per-phase detail                                                         |
| [Rules authority](docs/project/rules-authority.md)     | Which rules source wins a conflict, and every RRG and rulings page                                       |
| [CHANGELOG.md](CHANGELOG.md)                           | Every release's changes                                                                                  |

## License

Copyright (C) 2026 Quin Carter. The source code is licensed under the **GNU Affero General Public License v3.0 or
later**; see [LICENSE](LICENSE). The license covers this project's own code only. _Marvel Champions: The Card Game_,
its card text, rules, artwork, characters and trademarks are the property of Fantasy Flight Games and Marvel and are
**not** licensed under the AGPL; neither is any third-party artwork, music or other material in this repository, which
remains its owners' under their own terms.

## Special thanks

The game gets better every time someone plays it and tells us what broke. These lists refresh with every release
(`scripts/release-credits.mjs`), and each release's notes thank the people behind its fixes.

### The Watchers

They see everything. Reporters and feature requesters with at least two issues that got fixed or built, most first.

<!-- credits:reporters:start -->
<table>
<tr><td align="center"><a href="https://github.com/bluefireF5ran"><img src="https://github.com/bluefireF5ran.png?size=128" width="64" height="64" alt="Francisco Merchán Cordero"><br><sub><b>Francisco Merchán Cordero</b></sub></a></td><td align="center"><a href="https://github.com/PermaKarma"><img src="https://github.com/PermaKarma.png?size=128" width="64" height="64" alt="PermaKarma"><br><sub><b>PermaKarma</b></sub></a></td><td align="center"><a href="https://github.com/zackburnley"><img src="https://github.com/zackburnley.png?size=128" width="64" height="64" alt="Zack Burnley"><br><sub><b>Zack Burnley</b></sub></a></td><td align="center"><a href="https://github.com/Lemantia"><img src="https://github.com/Lemantia.png?size=128" width="64" height="64" alt="Lemantia"><br><sub><b>Lemantia</b></sub></a></td><td align="center"><a href="https://github.com/AlecHolland1582"><img src="https://github.com/AlecHolland1582.png?size=128" width="64" height="64" alt="AlecHolland1582"><br><sub><b>AlecHolland1582</b></sub></a></td><td align="center"><a href="https://github.com/andy-xxvii27"><img src="https://github.com/andy-xxvii27.png?size=128" width="64" height="64" alt="andy-xxvii27"><br><sub><b>andy-xxvii27</b></sub></a></td></tr>
<tr><td align="center"><a href="https://github.com/neopolii"><img src="https://github.com/neopolii.png?size=128" width="64" height="64" alt="neopolii"><br><sub><b>neopolii</b></sub></a></td><td align="center"><a href="https://github.com/Kravenprime"><img src="https://github.com/Kravenprime.png?size=128" width="64" height="64" alt="Kravenprime"><br><sub><b>Kravenprime</b></sub></a></td><td align="center"><a href="https://github.com/FirePenguin17"><img src="https://github.com/FirePenguin17.png?size=128" width="64" height="64" alt="FirePenguin17"><br><sub><b>FirePenguin17</b></sub></a></td><td align="center"><a href="https://github.com/Vasko47"><img src="https://github.com/Vasko47.png?size=128" width="64" height="64" alt="Viliam Jozef Vasilík"><br><sub><b>Viliam Jozef Vasilík</b></sub></a></td><td align="center"><a href="https://github.com/benhgomez"><img src="https://github.com/benhgomez.png?size=128" width="64" height="64" alt="benhgomez"><br><sub><b>benhgomez</b></sub></a></td><td align="center"><a href="https://github.com/dwballance"><img src="https://github.com/dwballance.png?size=128" width="64" height="64" alt="dwballance"><br><sub><b>dwballance</b></sub></a></td></tr>
<tr><td align="center"><a href="https://github.com/javgoro"><img src="https://github.com/javgoro.png?size=128" width="64" height="64" alt="javgoro"><br><sub><b>javgoro</b></sub></a></td><td align="center"><a href="https://github.com/Joelstrd"><img src="https://github.com/Joelstrd.png?size=128" width="64" height="64" alt="Joelstrd"><br><sub><b>Joelstrd</b></sub></a></td><td align="center"><a href="https://github.com/macrouldba"><img src="https://github.com/macrouldba.png?size=128" width="64" height="64" alt="macrouldba"><br><sub><b>macrouldba</b></sub></a></td><td align="center"><a href="https://github.com/Perezh21"><img src="https://github.com/Perezh21.png?size=128" width="64" height="64" alt="Perezh21"><br><sub><b>Perezh21</b></sub></a></td><td align="center"><a href="https://github.com/sgaon42"><img src="https://github.com/sgaon42.png?size=128" width="64" height="64" alt="sgaon42"><br><sub><b>sgaon42</b></sub></a></td><td align="center"><a href="https://github.com/telemak0"><img src="https://github.com/telemak0.png?size=128" width="64" height="64" alt="telemak0"><br><sub><b>telemak0</b></sub></a></td></tr>
</table>
<!-- credits:reporters:end -->

### Earth's Mightiest Committers

Everyone whose code is in the game.

<!-- credits:contributors:start -->
<table>
<tr><td align="center"><a href="https://github.com/quincarter"><img src="https://github.com/quincarter.png?size=128" width="64" height="64" alt="Quin Carter"><br><sub><b>Quin Carter</b></sub></a></td><td align="center"><a href="https://github.com/bluefireF5ran"><img src="https://github.com/bluefireF5ran.png?size=128" width="64" height="64" alt="Francisco Merchán Cordero"><br><sub><b>Francisco Merchán Cordero</b></sub></a></td></tr>
</table>
<!-- credits:contributors:end -->

### Spanish card scans

Every Spanish build shows the Spanish card scans that [alaintxu](https://github.com/alaintxu) collected and checked in
[mc-ocr](https://github.com/alaintxu/mc-ocr), used here with their permission
([#337](https://github.com/quincarter/marvel-champions-digital-game/issues/337)). Thanks also to
[AntonioAPG](https://github.com/AntonioAPG), who asked for Spanish cards and pointed us to them.

<table>
<tr><td align="center"><a href="https://github.com/alaintxu"><img src="https://github.com/alaintxu.png?size=128" width="64" height="64" alt="alaintxu"><br><sub><b>alaintxu</b></sub></a><br><sub>mc-ocr</sub></td><td align="center"><a href="https://github.com/AntonioAPG"><img src="https://github.com/AntonioAPG.png?size=128" width="64" height="64" alt="AntonioAPG"><br><sub><b>AntonioAPG</b></sub></a><br><sub>Spanish cards request</sub></td></tr>
</table>

Reported something on Discord or through the in-game bug button and want to be listed? Add yourself to
[`.github/credits.json`](.github/credits.json) or ask in an issue.

### Shadowland and promo card scans

Shadowland's cards use the scans from a community folder that
[u/Ok-Replacement-9793](https://www.reddit.com/r/marvelchampionslcg/comments/1cl3ebl/comment/19rwl0p0ibq5g/) shared on Reddit, and the promo cards use the scans they shared too. Thank you!
