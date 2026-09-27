# Marvel Champions: Digital Edition

## What this project is

A digital implementation of **Marvel Champions: The Card Game** (Fantasy Flight Games / Marvel), built to be a genuinely playable, rules-accurate video game — not a card browser, not a wiki, not a website with card images on it. Every design and engineering decision should be made with the question: _"does this hold up as a real game, running a real rules engine, the way a professional game studio would build one?"_

This is a fan-made, non-commercial project. Marvel Champions, its card text, artwork, and characters are the intellectual property of Fantasy Flight Games and Marvel.

## Source of truth for rules

The official **Rules Reference Guide (RRG)**, the **FAQ/rulings**, and **errata** are the only authorities on how the game behaves. **The current RRG (v1.8, July 2026) is in the repo root: [mc_rulesreference_v18_compressed.pdf](mc_rulesreference_v18_compressed.pdf).** Read it from there (the Read tool's `pages` parameter) rather than fetching it from the web, and cite its page numbers. Per-product rules inserts are not in the repo yet.

**Official FFG rulings since RRG 1.7 are in [marvel-champions-rulings-post-rrg-1-7.md](marvel-champions-rulings-post-rrg-1-7.md):** Hall of Heroes' transcription of rulings from FFG's Game Rules Specialist, December 17, 2025 through August 13, 2026, with links to every earlier RRG and rulings page. Use it to confirm rulings. Hall of Heroes is the transcriber rather than the authority, so cite a ruling by its date heading alongside the RRG page it clarifies. Where a ruling and the RRG disagree, the ruling is FFG's later clarification; flag the conflict rather than silently picking one. Community sites (Hall of Heroes, MarvelCDB, etc.) are useful _pointers_ into that material but are never authoritative on their own — if a community writeup and the RRG/FAQ conflict, the RRG/FAQ wins, and any implementation should be double-checked against the primary ruling before being trusted.

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

| Agent                          | Owns                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `game-rules-architect`         | Core state machine, turn/phase structure, the effect/trigger stack, keyword semantics           |
| `card-data-pipeline`           | Card data schema, ingesting/normalizing card data from source material, versioning by cycle/set |
| `ability-scripting-engineer`   | Turning printed card text into executable ability definitions via the ability DSL               |
| `encounter-ai-designer`        | Villain/minion/encounter deck AI decision logic, boost mechanics, modular set behavior          |
| `game-client-engineer`         | Board UI/UX, zones, drag-and-drop, card rendering, animation, accessibility                     |
| `multiplayer-netcode-engineer` | Multiplayer state sync, turn/action authority, reconnect handling, 1–4 player co-op             |
| `rules-qa-engineer`            | Regression tests tied to specific rulings/FAQ entries, scenario replay testing, drift detection |
| `content-release-tracker`      | Keeping the card pool current as new packs/cycles/errata/taboo changes release                  |

See [PLAN.md](PLAN.md) for the build roadmap and current phase.

### How to split work across agents (decided 2026-09-26)

- **One small task per agent.** One engine primitive (one spec §3 section), one ruling, or one card group — never a
  whole spec section list, hero or pack. An agent given everything reached ~680k tokens of context; one-section agents
  finish in 50k–300k. Specialist agents have no Agent tool, so the **main session does the splitting**, briefs each
  agent with only its own spec section, and asks for a short handoff note (files touched, groundwork laid).
- **Card scripting per hero:** (1) registry scaffold + identity; then side by side (2) events, (3) supports / upgrades /
  allies, (4) obligation + nemesis set, each in its own module
  (`packages/cards/src/wave<N>/<pack>/<hero>/{identity,events,support-upgrades-allies,obligation-nemesis}.ts`) so
  parallel agents never share a file; then (5) a precon e2e game. Encounter content: one agent per encounter set, or
  per scenario's villain + main scheme.
- **Parallel only when file sets don't overlap**, at most 3 agents at once. Agents edit the session's own worktree (a
  hook blocks writes to sibling worktrees), so they share one working tree and one git index.
- **Shared-index commit discipline** (a partial stage once broke HEAD): stage only your own hunks (`git apply --cached`
  a patch when a file mixes agents), read `git diff --cached` right before committing, commit with an explicit
  pathspec (`git commit -m … -- <paths>`), then check `git diff HEAD -- <your files>` shows nothing of yours left.
  **While more than one agent works in a worktree, every commit uses `--no-verify`**, after running
  `pnpm exec oxlint` / `pnpm exec oxfmt --check` on your own files yourself. The pre-commit hook's lint-staged hides
  and restores unstaged changes and re-stages from the working tree: it has swept other agents' lines into a commit
  (an import of a file that didn't exist yet) and, on 2026-09-26, reverted other agents' uncommitted edits and a new
  file while it ran. Commit a new module in the same commit as the line that imports it. Check
  `git branch --show-current` before committing (a detached HEAD once stranded commits). Never `git stash`,
  `git add -A`, `git checkout <sha>` / `git switch --detach`, `git checkout -- <file>` on another agent's file,
  `git reset`, `git clean`, or repo-wide `pnpm fmt`. **No debugging edits in shared files** (a `console.log` in an
  engine file): debug in a scratch test file of your own and delete it before committing.
- **Agents don't edit the wave spec's status or open questions**; they report, and the main session verifies (runs
  the tests, reads the diff) before flipping a status or ticking the PR. Rules questions go to the user as short
  multiple-choice prompts with a recommended default; answers are recorded in the spec's §4.1 table and the PR.
- The live state of a wave (agents, worktree, what's next) is kept in its PR description's handoff section.

## Working conventions

- **Commit authorship (decided 2026-09-27):** every commit is authored and committed as the user, `Quin Carter
<quin.carter@gmail.com>` (GitHub `quincarter`) — set `git config user.name` / `user.email` to that before the first
  commit in a fresh clone or cloud session. No `Co-Authored-By: Claude …` trailer, no `Claude-Session:` line, no
  "Generated with Claude Code" line or any other attribution to Claude in commit messages or PR descriptions.
- **Tech stack (decided in Phase 0):**
  - **TypeScript everywhere**, strict mode (`tsconfig.base.json`). _Why:_ hundreds of card-defined effects need a type system that catches shape errors in ability definitions at compile time; one language across engine/content/client avoids serializing game state across a language boundary.
  - **pnpm workspaces monorepo** with four packages: `@mc/engine` (headless rules engine — no rendering, no I/O), `@mc/content` (card schema + structured card data, no art), `@mc/cards` (card ability scripts), `@mc/client` (the tabletop-style UI). _Why:_ the engine/client/content boundary is load-bearing — `game-rules-architect` and `game-client-engineer` should never need to touch each other's internals. Dependency direction is strictly `client → cards → engine → content`; the engine must never import from the cards or client packages.
  - `@mc/cards` owns the ability DSL (builders that compile to the engine's plain-data `AbilityDefinition`s), one ability module per hero kit / aspect / encounter set, the assembled `AbilityRegistry` passed to the engine via `EngineDeps`, and scenario/deck builders (`coreScenario(...)`). Engine code never names specific cards.
  - **Vitest** for tests, colocated as `src/**/*.test.ts`. _Why:_ the engine is validated primarily through scenario/ruling tests (PLAN.md Phase 6), so the runner is a day-one dependency, and Vitest runs TS directly with no build step.
  - **Presentation:** a 2D tabletop-style card game in the mold of _Sentinels of the Multiverse_ (digital edition), built as a single cross-platform client — web-first, packageable to desktop/mobile later (Tauri/Capacitor or similar; the specific wrapper is a Phase 8 packaging choice, not a Phase 0 one). Not a 3D Tabletop-Simulator sim. **Client framework (decided at the start of Phase 4): pure Phaser 4, with rexUI (`phaser4-rex-plugins`) as the UI toolkit behind our own `Mc*` widget layer.** Phaser draws every screen, the table and every overlay; there is no DOM UI framework. It was chosen for a unified game feel, not for performance. Phaser is a view, never an authority: game state lives only in the engine. View models are plain TypeScript tested with Vitest, and scenes stay thin. The full architecture rules are in PLAN.md Phase 4. The client package is a placeholder until Phase 4 work lands.
  - **Persistence:** local-only save/resume via serialized engine state until Phase 5; the engine's state is plain serializable data specifically so a backend can be added later without redesign.
  - Run `pnpm test` / `pnpm typecheck` from the root to exercise every package.
  - **Lint and format (added 2026-09-21): oxlint and oxfmt.** `pnpm lint` (`.oxlintrc.json`: the correctness category plus `no-unused-vars` with a `_` escape hatch; `unicorn/no-thenable` is off because the ability DSL's `then:` branches are not promises, and `unicorn/no-useless-spread` is off because the engine's `for (const x of [...list])` loops snapshot a collection on purpose), `pnpm fmt` / `pnpm fmt:check` (`.oxfmtrc.json`: 120 columns, otherwise Prettier defaults; generated card data, the design canvases, the generated card reference, the rulings transcript and changie's own output (`.changes/`, `CHANGELOG.md`, which the release workflow's `fmt:check` gate would otherwise reject) are ignored). `pnpm check` runs both before typecheck, tests and build, and the versioned pre-commit hook in `.githooks/` (installed by `pnpm install` through the root `prepare` script) runs them on the staged files via lint-staged. Write code to the width; don't reflow by hand.
- **Changelog (changie).** Every change that lands on `main` carries an unreleased changelog fragment: run `changie new -k <Kind> -b "<one line>"` (kinds in `.changie.yaml`: Added, Changed, Fixed, Engine, Content, Docs) and commit the `.changes/unreleased/*.yaml` it writes with the code. Wait a second between two `changie new` calls — fragments are named by kind and timestamp to the second, and a second call in the same second overwrites the first. Releases batch the fragments into `CHANGELOG.md` (README.md covers the release flow).
- Favor explicit, inspectable game state over cleverness — this is the kind of system where a bug means a card behaves wrong in a way a real player will notice ("why didn't Toughness stop that damage?"), so state and effect resolution should be easy to log and step through.
- When implementing a card or keyword, cite the RRG section or FAQ ruling being followed in code comments only when the behavior is non-obvious from the card text alone (e.g. an interaction order that isn't intuitive).
