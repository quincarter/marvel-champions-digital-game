# Marvel Champions: Digital Edition

A digital, rules-accurate implementation of **Marvel Champions: The Card Game** (Fantasy Flight Games / Marvel), built to be a genuinely playable video game driven by a robust, deterministic rules engine.

> [!NOTE]
> This is a fan-made, non-commercial project. _Marvel Champions: The Card Game_, card text, artwork, and characters are the intellectual property of Fantasy Flight Games and Marvel.

---

## Overview & Philosophy

Marvel Champions is a cooperative Living Card Game (LCG) featuring intricate turn structures (Hero Phase ⟷ Villain Phase), simultaneous timing windows ("When", "Interrupt", "Response"), card-driven ability stacks, status effects, and dozens of interacting keywords.

This project is built **rules-engine-first**:

- **Deterministic State Machine**: Game state is completely serializable, reproducible, and decoupled from any presentation or I/O layer.
- **RRG as Authority**: Follows the official Fantasy Flight Games _Rules Reference Guide_ (RRG 1.5–1.8), official FAQ rulings, and errata.
- **Headless Rules Engine**: The engine runs independently with zero DOM or rendering dependencies, capable of simulating and auditing full games headlessly.
- **Phaser as a Pure View**: The client UI is purely a presentation layer that dispatches player commands and reflects state; it never decides game rules or move legality.

---

## Repository Architecture

This monorepo is organized with **pnpm workspaces** under `packages/`. The dependency graph enforces strict directional boundaries: `client → cards → engine → content`.

```
marvel-champions-game/
├── packages/
│   ├── content/    # (@mc/content) Card data schema, normalization & MarvelCDB ingestion
│   ├── engine/     # (@mc/engine) Headless rules engine, state machine, timing windows, legal actions
│   ├── cards/      # (@mc/cards) Card ability DSL, Core Set script definitions, scenario builders
│   └── client/     # (@mc/client) 2D tabletop game UI built with Phaser 4 & rexUI
├── docs/           # Specifications for completed milestones and engine features
├── assets/         # Local assets & card scan pointers (gitignored)
├── CLAUDE.md       # Engineering conventions & specialist agent roles
├── PLAN.md         # Master project roadmap and phase tracking
└── package.json    # Monorepo scripts and root dependencies
```

### Package Details

| Package                               | Purpose                                                                                                                                                                                                                                                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **[`@mc/content`](packages/content)** | Contains typed card schemas (`AnyCard`, `ScalingValue`, `KeywordInstance`, `AbilityReference`), normalized card data, and ingestion scripts (`ingest-marvelcdb.ts`) that curate card text and stats from MarvelCDB / Cerebro. Stores artwork references rather than raw image bytes.                            |
| **[`@mc/engine`](packages/engine)**   | The authoritative rules engine. Implements game state (`GameState`), phase loops, interrupt/response timing stacks, keyword resolution (Guard, Overkill, Retaliate, Surge, Toughness, etc.), villain AI phase handling, legal action generation (`legalActions`), and replayable command logs (`applyCommand`). |
| **[`@mc/cards`](packages/cards)**     | Houses the Ability DSL for scripting card behaviors into engine `AbilityDefinition`s. Implements all 233 Core Set card abilities across 5 heroes (Spider-Man, Captain Marvel, She-Hulk, Iron Man, Black Panther), 4 aspects, basic cards, and 3 villain scenarios (Rhino, Klaw, Ultron).                        |
| **[`@mc/client`](packages/client)**   | A 2D tabletop client inspired by digital card games like _Sentinels of the Multiverse_. Built with **Phaser 4**, **rexUI**, and **Vite**. Runs the engine inside a Web Worker via `EngineHost` for fluid 60 FPS rendering while calculating complex turn states.                                                |

---

## Tech Stack

- **Language**: TypeScript (Strict mode across all packages)
- **Monorepo & Package Manager**: pnpm workspaces (Node.js >= 22)
- **Rules Simulation & Ability DSL**: Pure TypeScript headless state machine
- **Frontend / Client**: Phaser 4 (`phaser` ^4.2.1) + rexUI (`phaser4-rex-plugins`) + Vite
- **Testing**: Vitest (colocated `*.test.ts` suites across all packages)
- **Toolchain / Task Runner**: Mise (optional, delegates to `pnpm` scripts)

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (>= 22.0.0)
- [pnpm](https://pnpm.io/) (>= 11.24.0)

### Installation

```bash
# Clone the repository
git clone https://github.com/quincarter/marvel-champions-game.git
cd marvel-champions-game

# Install workspace dependencies
pnpm install
```

### Running the Client

Start the Vite development server:

```bash
pnpm dev
# or
pnpm --filter @mc/client dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to play.

### Running Tests & Typechecks

```bash
# Run all unit and scenario test suites across all packages
pnpm test

# Typecheck all packages
pnpm typecheck

# Full CI check (typecheck + test + build)
pnpm check
```

### Card Data Ingestion

To re-ingest and normalize card data from MarvelCDB:

```bash
# Ingest Core Set card data from MarvelCDB
pnpm ingest

# Re-normalize using committed offline cache
pnpm --filter @mc/content ingest -- --pack core --offline
```

---

## Current Status & Roadmap

- [x] **Phase 0 — Foundations & Architecture**: Monorepo scaffolding, schema definitions, tech stack selection.
- [x] **Phase 1 — Core Rules Engine**: Headless state machine, turn structure, timing windows, keyword mechanics, deterministic command log & replays.
- [x] **Phase 2 — Content Pipeline & Core Set**: MarvelCDB ingestion & curation, ability DSL, all 233 Core Set cards scripted and validated.
- [x] **Phase 3 — Encounter & Villain AI**: Villain phase automation, decision routing, boost card mechanics, villain phase auditing across 48 test matrix games.
- [~] **Phase 4 — Client UI/UX (In Progress)**: Phaser 4 board scenes, Web Worker engine host, view models, legal action overlays, and fully playable solo games.
- [ ] **Phase 5 — Multiplayer & Netcode**: Co-op multiplayer state sync and networking.
- [ ] **Phase 6 — Rules QA & Drift Detection**: Automated rulings regression testing.
- [ ] **Phase 7 — Expansions & Content Cycles**: Post-core hero packs, campaign expansions, and new mechanics.

Refer to [`PLAN.md`](PLAN.md) and [`CLAUDE.md`](CLAUDE.md) for full architectural documentation and roadmap details.
