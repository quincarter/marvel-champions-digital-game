# Marvel Champions: Digital Edition

## What this project is

A digital implementation of **Marvel Champions: The Card Game** (Fantasy Flight Games / Marvel), built to be a genuinely playable, rules-accurate video game — not a card browser, not a wiki, not a website with card images on it. Every design and engineering decision should be made with the question: *"does this hold up as a real game, running a real rules engine, the way a professional game studio would build one?"*

This is a fan-made, non-commercial project. Marvel Champions, its card text, artwork, and characters are the intellectual property of Fantasy Flight Games and Marvel.

## Source of truth for rules

The official **Rules Reference Guide (RRG)**, the **FAQ/rulings**, and **errata** are the only authorities on how the game behaves. Community sites (Hall of Heroes, MarvelCDB, etc.) are useful *pointers* into that material but are never authoritative on their own — if a community writeup and the RRG/FAQ conflict, the RRG/FAQ wins, and any implementation should be double-checked against the primary ruling before being trusted.

[hallofheroes-llms.txt](hallofheroes-llms.txt) is an index of links into hallofheroeslcg.com (rulings pages, keyword lists, per-hero-pack release pages, cycle/box pages, taboo list, errata pack, card database browse page, etc.). **It is a link index of blog/wiki pages, not a structured data feed or an image CDN.** There is no ready-made JSON of card stats or a folder of card images anywhere yet — turning this into structured, versioned card data (text, stats, keywords, images, set/cycle membership) is real ingestion work and is owned by the `card-data-pipeline` agent. Don't assume the data is "already mapped"; assume it has to be fetched, parsed, normalized, and validated.

Useful anchor pages inside that index:
- `Marvel Champions LCG Keyword and Mechanic List` — canonical keyword definitions, updated per-cycle.
- `Marvel Champions LCG card database` (`/browse/`) — cycle-by-cycle navigation for every released product.
- `Latest FFG Rulings` (pre/post RRG 1.5–1.8) and `Marvel Champions LCG Unofficial Taboo list` — the FAQ/errata trail.
- Per-hero and per-box pages (e.g. `Core Set`, `Sinister Motives`, `The Rise of Red Skull`) — release dates, card counts, insert/campaign log links, starter decklists.

## How this repo should think about the problem

Marvel Champions is a cooperative LCG with a real-time-feeling but turn-structured rules engine: Villain Phase → Hero Phase → Villain Phase loop, a card-driven effect/trigger system ("when," "after," "response," "interrupt"), an encounter deck + modular sets + villain deck driving AI-controlled opposition, and dozens of keywords (Guard, Overkill, Retaliate X, Peril, Surge, Toughness, Restricted, Quickstrike, Alliance, Teamwork, Requirement, Steady, Discount, Vulnerable, Uses X, etc.) that each have precise, sometimes non-obvious interactions. This is a **rules-engine-first** project: the simulation must be correct before it needs to be pretty, and the simulation should be built the way a game studio builds a rules-heavy simulation (deterministic state machine, explicit effect/trigger stack, replayable game log) rather than as ad-hoc UI logic.

Card abilities are the long tail of this project — there are hundreds of uniquely-worded cards. They should be implemented through a consistent ability-scripting approach (a small internal DSL/interpreter over the state machine), not as one-off special-cased code per card, so new sets can be added without the core engine changing shape.

## Agents

This repo defines specialized subagents under `.claude/agents/` that model the roles a real game studio would staff for this kind of project. Prefer delegating to the matching specialist rather than doing cross-cutting engine/content/UI/AI work all in the main thread:

| Agent | Owns |
|---|---|
| `game-rules-architect` | Core state machine, turn/phase structure, the effect/trigger stack, keyword semantics |
| `card-data-pipeline` | Card data schema, ingesting/normalizing card data from source material, versioning by cycle/set |
| `ability-scripting-engineer` | Turning printed card text into executable ability definitions via the ability DSL |
| `encounter-ai-designer` | Villain/minion/encounter deck AI decision logic, boost mechanics, modular set behavior |
| `game-client-engineer` | Board UI/UX, zones, drag-and-drop, card rendering, animation, accessibility |
| `multiplayer-netcode-engineer` | Multiplayer state sync, turn/action authority, reconnect handling, 1–4 player co-op |
| `rules-qa-engineer` | Regression tests tied to specific rulings/FAQ entries, scenario replay testing, drift detection |
| `content-release-tracker` | Keeping the card pool current as new packs/cycles/errata/taboo changes release |

See [PLAN.md](PLAN.md) for the build roadmap and current phase.

## Working conventions

- **Tech stack (decided in Phase 0):**
  - **TypeScript everywhere**, strict mode (`tsconfig.base.json`). *Why:* hundreds of card-defined effects need a type system that catches shape errors in ability definitions at compile time; one language across engine/content/client avoids serializing game state across a language boundary.
  - **pnpm workspaces monorepo** with four packages: `@mc/engine` (headless rules engine — no rendering, no I/O), `@mc/content` (card schema + structured card data, no art), `@mc/cards` (card ability scripts), `@mc/client` (the tabletop-style UI). *Why:* the engine/client/content boundary is load-bearing — `game-rules-architect` and `game-client-engineer` should never need to touch each other's internals. Dependency direction is strictly `client → cards → engine → content`; the engine must never import from the cards or client packages.
  - `@mc/cards` owns the ability DSL (builders that compile to the engine's plain-data `AbilityDefinition`s), one ability module per hero kit / aspect / encounter set, the assembled `AbilityRegistry` passed to the engine via `EngineDeps`, and scenario/deck builders (`coreScenario(...)`). Engine code never names specific cards.
  - **Vitest** for tests, colocated as `src/**/*.test.ts`. *Why:* the engine is validated primarily through scenario/ruling tests (PLAN.md Phase 6), so the runner is a day-one dependency, and Vitest runs TS directly with no build step.
  - **Presentation:** a 2D tabletop-style card game in the mold of *Sentinels of the Multiverse* (digital edition), built as a single cross-platform client — web-first, packageable to desktop/mobile later (Tauri/Capacitor or similar; the specific wrapper is a Phase 8 packaging choice, not a Phase 0 one). Not a 3D Tabletop-Simulator sim. **Client framework (decided at the start of Phase 4): pure Phaser 4, with rexUI (`phaser4-rex-plugins`) as the UI toolkit behind our own `Mc*` widget layer.** Phaser draws every screen, the table and every overlay; there is no DOM UI framework. It was chosen for a unified game feel, not for performance. Phaser is a view, never an authority: game state lives only in the engine. View models are plain TypeScript tested with Vitest, and scenes stay thin. The full architecture rules are in PLAN.md Phase 4. The client package is a placeholder until Phase 4 work lands.
  - **Persistence:** local-only save/resume via serialized engine state until Phase 5; the engine's state is plain serializable data specifically so a backend can be added later without redesign.
  - Run `pnpm test` / `pnpm typecheck` from the root to exercise every package.
- Favor explicit, inspectable game state over cleverness — this is the kind of system where a bug means a card behaves wrong in a way a real player will notice ("why didn't Toughness stop that damage?"), so state and effect resolution should be easy to log and step through.
- When implementing a card or keyword, cite the RRG section or FAQ ruling being followed in code comments only when the behavior is non-obvious from the card text alone (e.g. an interaction order that isn't intuitive).
