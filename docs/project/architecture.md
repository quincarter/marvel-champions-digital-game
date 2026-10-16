# Architecture

[README](../../README.md) · [Current status](current-status.md) · [Architecture](architecture.md) · [Downloads](downloads.md) · [Contributing](../../CONTRIBUTING.md)

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

| Package                                     | Purpose                                                                                                                                                                                                                          |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[`@mc/content`](../../packages/content)** | Typed card schemas, normalized card data for every ingested pack, starter decks, and the ingestion scripts that curate card text and stats from MarvelCDB. Stores artwork references rather than image bytes.                    |
| **[`@mc/engine`](../../packages/engine)**   | The authoritative rules engine: game state, phase loops, interrupt/response timing, keyword resolution, the villain phase, deck legality (`validateDeck`), legal action generation (`legalActions`) and replayable command logs. |
| **[`@mc/cards`](../../packages/cards)**     | The ability DSL that turns printed card text into engine `AbilityDefinition`s, one module per hero kit, aspect and encounter set, plus scenario and campaign builders.                                                           |
| **[`@mc/client`](../../packages/client)**   | A 2D tabletop client in the mold of _Sentinels of the Multiverse_, built with **Phaser 4**, **rexUI** and **Vite**, running the engine in a Web Worker. Packaged for desktop with Tauri and for Android with Capacitor.          |

## Running it locally

You need [Node.js](https://nodejs.org/) (>= 22) and [pnpm](https://pnpm.io/) (>= 11.24).

```bash
git clone https://github.com/quincarter/marvel-champions-digital-game.git
cd marvel-champions-digital-game
pnpm install
pnpm dev
```

Then open [http://localhost:5173](http://localhost:5173). Tests, the e2e suite, card data ingestion and the release
flow are covered in [CONTRIBUTING.md](../../CONTRIBUTING.md).
