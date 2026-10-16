<div align="center">

<img src="packages/client/src-tauri/icons/128x128@2x.png" alt="Marvel Champions: Digital Edition logo" width="128">

# Marvel Champions: Digital Edition (Unofficial Fan Game)

[![Latest release](https://img.shields.io/github/v/release/quincarter/marvel-champions-digital-game?label=version&sort=semver)](https://github.com/quincarter/marvel-champions-digital-game/releases/latest)
[![Tests and build on main](https://img.shields.io/github/actions/workflow/status/quincarter/marvel-champions-digital-game/netlify-deploy.yml?branch=main&event=push&label=tests%20%26%20build&logo=github)](https://github.com/quincarter/marvel-champions-digital-game/actions/workflows/netlify-deploy.yml?query=branch%3Amain)
[![Release](https://github.com/quincarter/marvel-champions-digital-game/actions/workflows/release-on-merge.yml/badge.svg?branch=main)](https://github.com/quincarter/marvel-champions-digital-game/actions/workflows/release-on-merge.yml?query=branch%3Amain)
[![Netlify Status](https://api.netlify.com/api/v1/badges/487c224e-254f-42a0-a2b3-a6192b9e70c8/deploy-status)](https://app.netlify.com/projects/marvel-champions-digital-game/deploys)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue)](LICENSE)

</div>

A digital, rules-accurate implementation of **Marvel Champions: The Card Game** (Fantasy Flight Games / Marvel), built
to be a genuinely playable video game driven by a deterministic rules engine.

<p align="center">
  <a href="https://marvel-champions-digital-game.netlify.app/"><img src=".github/assets/readme/play-in-browser.svg" alt="Play in your browser" height="48"></a>
</p>

<p align="center">
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases/latest/download/MarvelChampions-Windows-x64-Setup.exe"><img src=".github/assets/readme/download-windows.svg" alt="Download for Windows" height="48"></a>
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases/latest/download/MarvelChampions-macOS-AppleSilicon-arm64.dmg"><img src=".github/assets/readme/download-macos-apple-silicon.svg" alt="Download for a Mac with Apple silicon" height="48"></a>
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases/latest/download/MarvelChampions-macOS-Intel-x64.dmg"><img src=".github/assets/readme/download-macos-intel.svg" alt="Download for an Intel Mac" height="48"></a>
</p>

<p align="center">
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases/latest/download/MarvelChampions-Linux-x64.AppImage"><img src=".github/assets/readme/download-linux.svg" alt="Download for Linux (AppImage)" height="48"></a>
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases/latest/download/MarvelChampions-Android.apk"><img src=".github/assets/readme/download-android.svg" alt="Download for Android" height="48"></a>
  <a href="https://github.com/quincarter/marvel-champions-digital-game/releases"><img src=".github/assets/readme/all-releases.svg" alt="View all releases" height="48"></a>
</p>

<p align="center">
  <a href="https://github.com/quincarter/marvel-champions-digital-game/issues/new?template=bug_report.yml"><img src=".github/assets/readme/report-a-bug.svg" alt="Report a bug" height="48"></a>
  <a href="https://github.com/quincarter/marvel-champions-digital-game/issues/new?template=feature_request.yml"><img src=".github/assets/readme/request-a-feature.svg" alt="Request a feature" height="48"></a>
  <a href="https://github.com/quincarter/marvel-champions-digital-game/issues/new?template=tested_deck_request.yml"><img src=".github/assets/readme/request-a-deck.svg" alt="Request a tested deck" height="48"></a>
</p>

<p align="center">
  <a href="#community"><img src=".github/assets/readme/discord.svg" alt="Discord (invite coming soon)" height="48"></a> <!-- TODO: point this at the Discord invite once the server exists. -->
  <a href="CONTRIBUTING.md"><img src=".github/assets/readme/contributing.svg" alt="Contributing" height="48"></a>
</p>

<p align="center"><sub>The download buttons fetch the newest release's installer. For the all-users Windows <code>.msi</code>, a Linux <code>.deb</code> or <code>.rpm</code>, or an older version, see <a href="https://github.com/quincarter/marvel-champions-digital-game/releases">all releases</a>. Not sure which issue type fits? Use the <a href="https://github.com/quincarter/marvel-champions-digital-game/issues/new/choose">issue chooser</a>.</sub></p>

> [!NOTE]
> This is a fan-made, non-commercial project. _Marvel Champions: The Card Game_, card text, artwork, and characters are
> the intellectual property of Fantasy Flight Games and Marvel.

<p align="center">
  <a href="#overview--philosophy">Overview</a> ·
  <a href="#tech-stack">Tech stack</a> ·
  <a href="#community">Community</a> ·
  <a href="#roadmap">Roadmap</a> ·
  <a href="docs/project/current-status.md">Current status</a> ·
  <a href="docs/project/architecture.md">Architecture</a> ·
  <a href="docs/project/downloads.md">Downloads</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
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
  its rulings decide how the game behaves.
- **Headless rules engine**: the engine has no DOM or rendering dependencies and can simulate and audit full games on
  its own.
- **Phaser as a pure view**: the client presents state and sends player commands; it never decides rules or move
  legality.

## Tech stack

- **Language**: TypeScript, strict mode in every package
- **Monorepo**: pnpm workspaces (Node.js >= 22)
- **Client**: Phaser 4 + rexUI (`phaser4-rex-plugins`) + Vite; Tauri 2 (desktop) and Capacitor (Android)
- **Testing**: Vitest unit and scenario suites, Playwright end-to-end suite
- **Lint and format**: oxlint and oxfmt
- **Changelog**: Changie

How the packages fit together, and how to run the game locally, is in [Architecture](docs/project/architecture.md).

## Community

- **Bugs, feature ideas and deck requests:** open an issue from the
  [issue chooser](https://github.com/quincarter/marvel-champions-digital-game/issues/new/choose). In the game, the bug
  icon in the top bar (or on the Title screen) opens Report an issue, which copies the game log for your report.
- **Rules questions:** check the [Rules Reference](mc_rulesreference_v18_compressed.pdf) and
  [FFG's rulings](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/) before filing a rules bug.
- **Discord:** _coming soon._ <!-- TODO: replace this line with the Discord invite link once the server exists. -->
- **Contributing:** see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests, conventions and the release flow.

## Roadmap

| Phase | What it covers                                                                                                | Status                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 0     | Foundations: monorepo, card schema, tech stack                                                                | ✅ Done                                                                                                      |
| 1     | Headless rules engine: state machine, turn structure, timing windows, keywords, replayable command log        | ✅ Done                                                                                                      |
| 2     | Card content pipeline and the Core Set: MarvelCDB ingestion, the ability DSL, all 233 Core Set cards scripted | ✅ Done                                                                                                      |
| 3     | Encounter and villain AI: villain phase automation, boost, decisions routed to the player the rules name      | ✅ Done                                                                                                      |
| 4     | Client: the Phaser 4 tabletop on desktop, tablet and phone                                                    | 🟡 Playable end to end; accessibility pass and remaining design-canvas screens in progress                   |
| 5     | Online multiplayer: 2–4 players over a network, reconnects, Epic Multiplayer for Loki                         | ⬜ Planned                                                                                                   |
| 6     | Rules QA: ruling-by-ruling tests, replay fixtures, drift detection on new errata                              | 🟡 Ongoing: per-wave rules audits, random-deck soaks, MarvelCDB decklist games, a Rules Reference v1.8 audit |
| 7     | Content beyond the Core Set, in release order                                                                 | 🟡 Through cycle 10 (Civil War); Fear No Evil next                                                           |
| 8     | Polish: onboarding, settings, audio, packaging, undo, hero AI                                                 | 🟡 Guided mode, settings, music, desktop and Android builds and undo landed; hero AI planned                 |
| 9     | Decks: precons, MarvelCDB import, in-app deck builder                                                         | ✅ Done                                                                                                      |

Next up:

- **Fear No Evil (cycle 11)**: its card data is in; scripting, its six-scenario campaign and its heroes come next.
- **Civil War leftovers**: the Synthezoid Smackdown scenario pack and competitive (team versus team) mode, which the
  game marks as coming soon.
- **Hero AI** to fill seats with computer-controlled heroes, then **online multiplayer** (Phase 5).

What you can play today is in [Current status](docs/project/current-status.md). The detailed plan, decisions and per-wave specs are in [PLAN.md](PLAN.md) and [`docs/`](docs).

---

## More

| Page                                             | What's in it                                                         |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| [Current status](docs/project/current-status.md) | What you can play today and what the next release adds               |
| [Architecture](docs/project/architecture.md)     | The four packages, how they depend on each other, running it locally |
| [Downloads](docs/project/downloads.md)           | Every installer, unsigned macOS builds, the in-app update notice     |
| [Contributing](CONTRIBUTING.md)                  | Setup, tests, CI, conventions, card data and the release flow        |
| [PLAN.md](PLAN.md)                               | The full roadmap, decisions and per-phase detail                     |
| [CHANGELOG.md](CHANGELOG.md)                     | Every release's changes                                              |

## License

Copyright (C) 2026 Quin Carter. The source code is licensed under the **GNU Affero General Public License v3.0 or
later**; see [LICENSE](LICENSE). The license covers this project's own code only. _Marvel Champions: The Card Game_,
its card text, rules, artwork, characters and trademarks are the property of Fantasy Flight Games and Marvel and are
**not** licensed under the AGPL; neither is any third-party artwork, music or other material in this repository, which
remains its owners' under their own terms.
