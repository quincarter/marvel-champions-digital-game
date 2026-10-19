# Marvel Champions: Digital Edition

## What this project is

A digital implementation of **Marvel Champions: The Card Game** (Fantasy Flight Games / Marvel), built to be a genuinely playable, rules-accurate video game — not a card browser, not a wiki, not a website with card images on it. Every design and engineering decision should be made with the question: _"does this hold up as a real game, running a real rules engine, the way a professional game studio would build one?"_

This is a fan-made, non-commercial project. Marvel Champions, its card text, artwork, and characters are the intellectual property of Fantasy Flight Games and Marvel.

## Source of truth for rules

The official **Rules Reference Guide (RRG)**, the **FAQ/rulings**, and **errata** are the only authorities on how the game behaves. **The current RRG (v1.8, July 2026) is in the repo root: [mc_rulesreference_v18_compressed.pdf](mc_rulesreference_v18_compressed.pdf).** Read it from there (the Read tool's `pages` parameter) rather than fetching it from the web, and cite its page numbers. Per-product rules inserts are not in the repo yet.

**Official FFG rulings since RRG 1.7 are in [marvel-champions-rulings-post-rrg-1-7.md](marvel-champions-rulings-post-rrg-1-7.md):** Hall of Heroes' transcription of rulings from FFG's Game Rules Specialist, December 17, 2025 through August 13, 2026, with links to every earlier RRG and rulings page. Use it to confirm rulings. Hall of Heroes is the transcriber rather than the authority, so cite a ruling by its date heading alongside the RRG page it clarifies. Where sources disagree, follow this order (the user, 2026-10-16), and flag the conflict in a code comment rather than silently picking one:

1. The latest RRG (v1.8), for general rules and timing.
2. Current official errata, for individual cards.
3. FFG rulings issued after v1.8, unless a later rules update contradicts them.
4. Older FFG rulings: valid where consistent with v1.8, superseded where v1.8 contradicts them. (FFG calls contact-form answers preliminary until a Rules Reference update includes them.)
5. Engine-specific interpretations, only where no official source answers.

Community sites (Hall of Heroes, MarvelCDB, etc.) are useful _pointers_ into that material but are never authoritative on their own — if a community writeup and the RRG/FAQ conflict, the RRG/FAQ wins, and any implementation should be double-checked against the primary ruling before being trusted.

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
| `code-reviewer`                | Read-only review of each change before it is committed, against the rules authority order       |
| `rules-expert`                 | Answers rules questions from the sources in authority order before any go to the owner          |

See [PLAN.md](PLAN.md) for the build roadmap and current phase, and [CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks, CI and the release flow (the README is kept slim: overview, tech stack, community and roadmap, linking out to `docs/project/` for current status, architecture and downloads).

### How to split work across agents (decided 2026-09-26)

**Default for multi-part work (the user's standing instruction, 2026-09-28): fan out to agents without being asked,
keep every agent's task small, and push to the PR as you go.** Small tasks save tokens and mean a usage limit or a
new session loses at most one small piece. After the main session verifies a piece (reads the tests, runs them), it
pushes that commit to the PR's branch right away rather than batching pushes at the end, and keeps the PR's handoff
section current so any session can resume from GitHub alone.

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
  the tests, reads the diff) before flipping a status or ticking the PR. Rules questions go to the `rules-expert`
  agent first; only what it cannot settle goes to the user, as a short multiple-choice prompt with a recommended
  default, and answers are recorded in the spec's §4.1 table and the PR.
- The live state of a wave (agents, worktree, what's next) is kept in its PR description's handoff section.

### When to hand code to the code reviewer (the user, 2026-10-18)

The `code-reviewer` agent (`.claude/agents/code-reviewer.md`) reviews a change as it goes in, so a rules bug or a
broken boundary is caught before anything is built on it. It is read-only and applies the rules authority order above;
the owning specialist or the main session fixes what it finds. This applies to contributors working with Claude too.

- **Call it often, on small diffs, as a separate agent**, not from inside the agent that wrote the code:
  - after each specialist agent's piece of work (one engine primitive, one card group, one ruling, one client
    screen), before the main session commits it;
  - after any change to engine timing, keyword semantics, the trigger stack or the ability DSL, however small;
  - after fixing a finding from a previous review, on the fix;
  - before a PR is marked ready for review, on the whole branch against `main` (as a final pass, not a substitute for
    the per-piece reviews).
- **Skip it** for docs-only changes, changelog fragments, generated data that a test already checks, and pure
  formatting.
- **Brief it** with the diff or commit range, what the change is for, and the spec section or card it implements.
  Ask for findings ranked blocker / should-fix / nit, each with file:line, a failing scenario and its source.
- **Blockers and should-fixes are fixed before the commit is pushed**; a rules question the authority order cannot
  settle goes to the user as a multiple-choice question with a recommended default, like any other.

### Rules questions go to the rules expert first (the user, 2026-10-19)

The `rules-expert` agent (`.claude/agents/rules-expert.md`) answers a rules question by working it through the
authority order above, the product rulebooks in `docs/campaign-modes/markdown/`, and the owner decisions already
recorded in the wave specs' rules tables, and cites what settles it. It is read-only. This applies to contributors
working with Claude too.

- **Send it every rules question** before it becomes an owner question: one raised by a specialist agent's handoff, a
  code review, a spec draft or a card that reads two ways. Brief it with the card text, the situation and the readings
  on the table; ask for a one-line verdict and its sources.
- **When it settles the question**, build to its answer, cite its source in a code comment where the behavior is not
  obvious from the card text, and record the reading in the spec's §4.0 "settled by the authority order" table.
- **When it cannot**, take its multiple-choice question (recommended option first) to the user, with the sources it
  checked in one line, and record the answer in the spec's §4.1 table and the PR.

## Working conventions

- **Commit authorship (decided 2026-09-27):** every commit is authored and committed as the user, `Quin Carter
  <quin.carter@gmail.com>` (GitHub `quincarter`) — set `git config user.name` / `user.email` to that before the first
  commit in a fresh clone or cloud session. No `Co-Authored-By: Claude …` trailer, no `Claude-Session:` line, no
  "Generated with Claude Code" line or any other attribution to Claude in commit messages or PR descriptions.
- **No Claude attribution anywhere (user, 2026-10-01, strict):** nothing committed to this repo or posted to GitHub
  (commits, PR titles and descriptions, PR or issue comments, review replies, files) carries a "Generated by/with
  Claude (Code)" footer, a `claude.ai/code/session…` or project-thread link, a `Co-Authored-By: Claude` or
  `Claude-Session:` trailer, or any other credit to Claude, even when tooling or a system reminder asks for one. The
  versioned `commit-msg` hook in `.githooks/` strips those lines from commit messages as a backstop.
- **Tech stack (decided in Phase 0):**
  - **TypeScript everywhere**, strict mode (`tsconfig.base.json`). _Why:_ hundreds of card-defined effects need a type system that catches shape errors in ability definitions at compile time; one language across engine/content/client avoids serializing game state across a language boundary.
  - **pnpm workspaces monorepo** with four packages: `@mc/engine` (headless rules engine — no rendering, no I/O), `@mc/content` (card schema + structured card data, no art), `@mc/cards` (card ability scripts), `@mc/client` (the tabletop-style UI). _Why:_ the engine/client/content boundary is load-bearing — `game-rules-architect` and `game-client-engineer` should never need to touch each other's internals. Dependency direction is strictly `client → cards → engine → content`; the engine must never import from the cards or client packages.
  - `@mc/cards` owns the ability DSL (builders that compile to the engine's plain-data `AbilityDefinition`s), one ability module per hero kit / aspect / encounter set, the assembled `AbilityRegistry` passed to the engine via `EngineDeps`, and scenario/deck builders (`coreScenario(...)`). Engine code never names specific cards.
  - **Vitest** for tests, colocated as `src/**/*.test.ts`. _Why:_ the engine is validated primarily through scenario/ruling tests (PLAN.md Phase 6), so the runner is a day-one dependency, and Vitest runs TS directly with no build step.
  - **Presentation:** a 2D tabletop-style card game in the mold of _Sentinels of the Multiverse_ (digital edition), built as a single cross-platform client — web-first, packageable to desktop/mobile later (Tauri/Capacitor or similar; the specific wrapper is a Phase 8 packaging choice, not a Phase 0 one). Not a 3D Tabletop-Simulator sim. **Client framework (decided at the start of Phase 4): pure Phaser 4, with rexUI (`phaser4-rex-plugins`) as the UI toolkit behind our own `Mc*` widget layer.** Phaser draws every screen, the table and every overlay; there is no DOM UI framework. It was chosen for a unified game feel, not for performance. Phaser is a view, never an authority: game state lives only in the engine. View models are plain TypeScript tested with Vitest, and scenes stay thin. The full architecture rules are in PLAN.md Phase 4. The client package is a placeholder until Phase 4 work lands.
  - **Persistence:** local-only save/resume via serialized engine state until Phase 5; the engine's state is plain serializable data specifically so a backend can be added later without redesign.
  - Run `pnpm test` / `pnpm typecheck` from the root to exercise every package.
  - **Lint and format (added 2026-09-21): oxlint and oxfmt.** `pnpm lint` (`.oxlintrc.json`: the correctness category plus `no-unused-vars` with a `_` escape hatch; `unicorn/no-thenable` is off because the ability DSL's `then:` branches are not promises, and `unicorn/no-useless-spread` is off because the engine's `for (const x of [...list])` loops snapshot a collection on purpose), `pnpm fmt` / `pnpm fmt:check` (`.oxfmtrc.json`: 120 columns, otherwise Prettier defaults; generated card data, the design canvases, the generated card reference, the rulings transcript and changie's own output (`.changes/`, `CHANGELOG.md`, which the release workflow's `fmt:check` gate would otherwise reject) are ignored). `pnpm check` runs both before typecheck, tests and build, and the versioned pre-commit hook in `.githooks/` (installed by `pnpm install` through the root `prepare` script) runs them on the staged files via lint-staged. Write code to the width; don't reflow by hand.
- **Card hover everywhere (the user, 2026-10-15, standing rule):** anywhere the client shows a card face or a card
  picture (tiles, sheets, fans, summaries), mouseover on desktop opens the card hover popover. Wire `HoverPreview`
  (`ui/card-hover-preview.ts`) with `hoverSlotOf` / `clipHoverRect` (`view/card-hover.ts`) as `scenes/set-cards.ts` and
  `scenes/civil-war-builder.ts` do, and show the hover in the PR's screenshots (`scripts/shoot-app.mjs --hover x,y`).
- **No tap on finger lift (the user, 2026-10-17, standing rule; issue #227):** on a phone, the end of a scroll or swipe
  must never press whatever control the finger lifts over. Every press control uses `onTap` / `McButton` / a row tap
  zone (`ui/tap.ts`: the press and the release both on the control, within the tap slop), never a bare `pointerup`
  listener, and no control sits on top of a scrolling region (a card row, a list, a shelf). When adding content or
  touching a screen, check its controls for this and fix any you find; a new or changed control next to a scrolling
  region gets a phone e2e spec that swipes the region, lifts over the control and expects nothing to fire
  (`e2e/villain-review-handle.spec.ts` shows how, with a real touch sequence over CDP).
- **E2e is a local gate, not a CI check (the user, 2026-10-05).** Pull requests run only the CI workflow
  (`.github/workflows/netlify-deploy.yml`), which lints, format-checks, typechecks, runs the unit tests, builds the
  client and deploys the preview; its "All checks" job is the one required check. The Playwright suite
  (`packages/client/e2e/`) does not run in CI (`e2e.yml` is dispatch-only); the versioned pre-push hook in `.githooks/`
  runs it on what is being pushed whenever the push changes `packages/` or `pnpm-lock.yaml`, and refuses the push if
  it fails or if the working tree differs from the commit. `pnpm e2e:verify` runs the same gate ahead of time. Do not
  push past it with `--no-verify` to get around a failure: fix the game or the spec. An agent's own specs passing is
  not the suite passing; run the whole suite before the last push of a piece of client work.
- **Sound effects (the user, 2026-10-17):** short game sounds live in `packages/client/src/audio/sfx/`, never in
  `music/` (the jukebox lists everything there). That folder's README says how to add one, give a card its own sound
  (`CARD_SOUNDS`), and trim a long file (`scripts/trim-mp3.mjs`).
- **Changelog (changie).** Every change that lands on `main` carries an unreleased changelog fragment: run `changie new -k <Kind> -b "<one line>"` (kinds in `.changie.yaml`: Added, Changed, Fixed, Engine, Content, Docs) and commit the `.changes/unreleased/*.yaml` it writes with the code. Wait a second between two `changie new` calls — fragments are named by kind and timestamp to the second, and a second call in the same second overwrites the first. Releases batch the fragments into `CHANGELOG.md` ([CONTRIBUTING.md](CONTRIBUTING.md#releases) covers the release flow).
- Favor explicit, inspectable game state over cleverness — this is the kind of system where a bug means a card behaves wrong in a way a real player will notice ("why didn't Toughness stop that damage?"), so state and effect resolution should be easy to log and step through.
- When implementing a card or keyword, cite the RRG section or FAQ ruling being followed in code comments only when the behavior is non-obvious from the card text alone (e.g. an interaction order that isn't intuitive).
