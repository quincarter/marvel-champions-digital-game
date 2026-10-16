# Marvel Champions: Digital Edition (Unofficial Fan Game)

[![Latest release](https://img.shields.io/github/v/release/quincarter/marvel-champions-digital-game?label=version&sort=semver)](https://github.com/quincarter/marvel-champions-digital-game/releases/latest)
[![CI](https://github.com/quincarter/marvel-champions-digital-game/actions/workflows/netlify-deploy.yml/badge.svg?branch=main)](https://github.com/quincarter/marvel-champions-digital-game/actions/workflows/netlify-deploy.yml?query=branch%3Amain)
[![Release](https://github.com/quincarter/marvel-champions-digital-game/actions/workflows/release-on-merge.yml/badge.svg?branch=main)](https://github.com/quincarter/marvel-champions-digital-game/actions/workflows/release-on-merge.yml?query=branch%3Amain)
[![Netlify Status](https://api.netlify.com/api/v1/badges/487c224e-254f-42a0-a2b3-a6192b9e70c8/deploy-status)](https://app.netlify.com/projects/marvel-champions-digital-game/deploys)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0--or--later-blue)](LICENSE)

A digital, rules-accurate implementation of **Marvel Champions: The Card Game** (Fantasy Flight Games / Marvel), built
to be a genuinely playable video game driven by a deterministic rules engine.

**[Play in your browser](https://marvel-champions-digital-game.netlify.app/)** ·
**[Download for Windows, macOS, Linux or Android](https://github.com/quincarter/marvel-champions-digital-game/releases/latest)** ·
**[Report a bug or request a feature](https://github.com/quincarter/marvel-champions-digital-game/issues/new/choose)** ·
**[Discord (invite coming soon)](#community)** ·
**[Contributing](CONTRIBUTING.md)**

> [!NOTE]
> This is a fan-made, non-commercial project. _Marvel Champions: The Card Game_, card text, artwork, and characters are
> the intellectual property of Fantasy Flight Games and Marvel.

---

## Current status

The game is playable today, solo or with 1–4 heroes played multi-handed on one device, from the Core Set through the
**Civil War** box (cycle 10). The latest release is shown in the version badge above; **v0.22.0** is the next one,
waiting in its release pull request.

What you can play:

- **Every hero, scenario and modular set from the Core Set through cycle 10**: the hero packs, campaign boxes and
  scenario packs of The Rise of Red Skull, The Galaxy's Most Wanted, The Mad Titan's Shadow, Sinister Motives, Mutant
  Genesis, NeXt Evolution, Age of Apocalypse, Agents of S.H.I.E.L.D. and Civil War (all but the Synthezoid Smackdown
  scenario pack), each card scripted against its printed text and errata and covered by rules tests.
- **Campaign mode for eight boxes**, from The Rise of Red Skull to Agents of S.H.I.E.L.D., with the campaign log carried
  between scenarios, expert campaign rules, story beats and each box's own between-game choices.
- **Civil War's custom scenario builder**: pick a leader, two main scheme stages and three or four modular sets, or let
  the game deal a random (or random and blind) scenario.
- **Decks**: every hero's starter deck, decks built in the in-app deck builder, and decks imported from MarvelCDB, all
  checked against the Rules Reference's deckbuilding rules. Community decklists from MarvelCDB are on the Decks screen.
- **Standard and expert difficulty**, a **Guided mode** with Try-it lessons for new players, **Undo** for your own
  moves this turn, and **local save and resume**.
- **Desktop, tablet, phone, keyboard and gamepad**: one client that runs in the browser and ships as desktop and Android
  apps, with the card hover popover on desktop and a thumb-reach layout on phones.

What is new in v0.22.0: the villain phase docks beside the table with your hand still in view, a Card size setting,
the card hover popover on every screen, the first player token, Set the table's modular set pictures and Random
button, the game's seed in the pause menu and game log, and Report an issue from any screen. The full list is in the
release notes and [CHANGELOG.md](CHANGELOG.md).

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

The detailed plan, decisions and per-wave specs are in [PLAN.md](PLAN.md) and [`docs/`](docs).

---

## Community

- **Bugs, feature ideas and deck requests:** open an issue from the
  [issue chooser](https://github.com/quincarter/marvel-champions-digital-game/issues/new/choose). In the game, the bug
  icon in the top bar (or on the Title screen) opens Report an issue, which copies the game log for your report.
- **Rules questions:** check the [Rules Reference](mc_rulesreference_v18_compressed.pdf) and
  [FFG's rulings](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/) before filing a rules bug.
- **Discord:** _coming soon._ <!-- TODO: replace this line with the Discord invite link once the server exists. -->
- **Contributing:** see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests, conventions and the release flow.

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

## Repository architecture

This monorepo is organized with **pnpm workspaces** under `packages/`. The dependency graph is strictly
`client → cards → engine → content`.

```
marvel-champions-digital-game/
├── packages/
│   ├── content/    # (@mc/content) Card data schema, normalization & MarvelCDB ingestion
│   ├── engine/     # (@mc/engine) Headless rules engine, state machine, timing windows, legal actions
│   ├── cards/      # (@mc/cards) Card ability DSL, card scripts, scenarios, campaigns
│   └── client/     # (@mc/client) 2D tabletop game UI built with Phaser 4 & rexUI
├── docs/           # Specifications, per-wave plans and rules QA reports
├── CLAUDE.md       # Engineering conventions & specialist agent roles
├── CONTRIBUTING.md # How to set up, test and contribute
├── PLAN.md         # Master roadmap and phase tracking
└── package.json    # Monorepo scripts and root dependencies
```

| Package                               | Purpose                                                                                                                                                                                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[`@mc/content`](packages/content)** | Typed card schemas, normalized card data for every ingested pack, starter decks, and the ingestion scripts that curate card text and stats from MarvelCDB. Stores artwork references rather than image bytes.                    |
| **[`@mc/engine`](packages/engine)**   | The authoritative rules engine: game state, phase loops, interrupt/response timing, keyword resolution, the villain phase, deck legality (`validateDeck`), legal action generation (`legalActions`) and replayable command logs. |
| **[`@mc/cards`](packages/cards)**     | The ability DSL that turns printed card text into engine `AbilityDefinition`s, one module per hero kit, aspect and encounter set, plus scenario and campaign builders.                                                           |
| **[`@mc/client`](packages/client)**   | A 2D tabletop client in the mold of _Sentinels of the Multiverse_, built with **Phaser 4**, **rexUI** and **Vite**, running the engine in a Web Worker. Packaged for desktop with Tauri and for Android with Capacitor.          |

## Tech stack

- **Language**: TypeScript, strict mode in every package
- **Monorepo**: pnpm workspaces (Node.js >= 22)
- **Client**: Phaser 4 + rexUI (`phaser4-rex-plugins`) + Vite; Tauri 2 (desktop) and Capacitor (Android)
- **Testing**: Vitest unit and scenario suites, Playwright end-to-end suite
- **Lint and format**: oxlint and oxfmt
- **Changelog**: Changie

## Running it locally

You need [Node.js](https://nodejs.org/) (>= 22) and [pnpm](https://pnpm.io/) (>= 11.24).

```bash
git clone https://github.com/quincarter/marvel-champions-digital-game.git
cd marvel-champions-digital-game
pnpm install
pnpm dev
```

Then open [http://localhost:5173](http://localhost:5173). Tests, the e2e suite, card data ingestion and the release
flow are covered in [CONTRIBUTING.md](CONTRIBUTING.md).

## Downloads

Every merge of a release pull request publishes a
[GitHub release](https://github.com/quincarter/marvel-champions-digital-game/releases/latest) with installers. Each
release's notes end with a "Which download do I need?" table.

- **Windows 11**: `-Windows-x64-Setup.exe` (per user, no admin rights) or `-Windows-x64-AllUsers.msi`.
- **macOS**: `-macOS-AppleSilicon-arm64.dmg` or `-macOS-Intel-x64.dmg`. If the build is unsigned, macOS blocks it on
  first launch: allow it in System Settings → Privacy & Security → Open Anyway, or run
  `xattr -dr com.apple.quarantine "/Applications/Marvel Champions.app"`.
- **Linux**: `.deb`, `.rpm` or `.AppImage` (x64).
- **Android**: `-Android.apk`.

The desktop and Android apps check GitHub for a newer release on launch and show an "Update available" banner on the
Title screen when one exists. The web app always runs the latest version.

---

## License

Copyright (C) 2026 Quin Carter

The source code in this repository is licensed under the **GNU Affero General Public License v3.0 or later** — see
[LICENSE](LICENSE).

```text
Marvel Champions: Digital Edition
Copyright (C) 2026  Quin Carter

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
```

The license covers this project's own code only. _Marvel Champions: The Card Game_, its card text, rules, artwork,
characters and trademarks are the property of Fantasy Flight Games and Marvel and are **not** licensed under the AGPL;
neither is any third-party artwork, music or other material in this repository, which remains its owners' under their
own terms.
