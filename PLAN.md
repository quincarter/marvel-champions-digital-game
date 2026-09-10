# PLAN: Marvel Champions Digital Edition

Status: **Phase 0 — not started.** Nothing has been built yet; this document is the roadmap. Update the Status line and check off phases as work lands.

This plan is intentionally sequenced rules-engine-first: a correct, headless simulation of a small card pool (the Core Set) before any UI polish, AI sophistication, or content breadth. A beautiful board that plays the game wrong is worse than an ugly board that plays it right.

## Phase 0 — Foundations & decisions

Owner: whoever kicks off the project (architectural decisions, not yet delegated to a single agent).

- [ ] Pick the tech stack. Considerations to weigh explicitly, not just default to whatever's familiar:
  - Target platform(s): web, desktop, mobile, or Tabletop-Simulator-style 3D? (Recommendation: web client + a platform-agnostic core engine package, so the rules engine isn't tied to a rendering framework.)
  - Language for the rules engine (needs strong typing for a system with hundreds of card-defined effects — TypeScript is a reasonable default given a web target).
  - Persistence approach for game state (local-only save/resume vs. a backend for multiplayer).
- [ ] Scaffold the repo: separate the **engine** (rules/state machine, no rendering, no I/O) from the **client** (UI) from **content** (card data). This boundary is load-bearing — `game-rules-architect` and `game-client-engineer` should never need to touch each other's internals to do their jobs.
- [ ] Set up whatever this stack needs for tests-as-first-class (the engine is going to be validated primarily through scenario tests, per Phase 6 — pick a test runner now, not later).
- [ ] Define the card data schema (delegate to `card-data-pipeline`): fields needed to represent every card type — Hero, Alter-Ego, Ally, Event, Support, Upgrade, Resource, Villain (front/back), Minion, Attachment, Main Scheme, Side Scheme, Treachery, Obligation, Environment, Boost/Player-side-scheme where relevant — including keywords, traits, cost, stats (ATK/THW/DEF/HP as applicable), and a slot for the ability-script reference used by `ability-scripting-engineer`.

## Phase 1 — Core rules engine (headless, no content yet)

Owner: `game-rules-architect`.

- [ ] Game state model: players, hero/alter-ego identity state, zones (hand, deck, discard, play area, victory pile), villain state, main scheme, side schemes, encounter deck/discard, threat/damage/HP counters.
- [ ] Turn structure state machine: Villain Phase (villain attacks/activates, encounter card draw) → Hero Phase (player turns: play cards, use actions, thwart/attack/defend/recover) → back to Villain Phase, with correct handling of first player and multiplayer turn order.
- [ ] Effect/trigger stack: an explicit, inspectable resolution stack supporting "when," "after," "response," "interrupt," and "forced" effects, with correct timing windows (this is where most rules bugs will originate if skipped).
- [ ] Core keyword semantics implemented against the state machine: Guard, Overkill, Retaliate X, Peril, Surge, Toughness, Restricted, Quickstrike, Alliance, Teamwork, Requirement, Steady, Discount, Vulnerable, Uses X — start with whatever subset the Core Set actually needs, expand per-cycle later.
- [ ] A game log / replay trace: every state transition and resolved effect should be recorded in a form that can be replayed and asserted on in tests (this is the backbone of Phase 6).
- [ ] Exit criteria: the engine can run a full Core Set game (headless, scripted inputs) from setup through win/loss without a UI.

## Phase 2 — Card content pipeline & vertical slice

Owner: `card-data-pipeline` for ingestion/schema, `ability-scripting-engineer` for turning text into behavior.

- [ ] Build the ingestion tooling that turns source material (card database pages, keyword list, rulings) into the structured schema from Phase 0 — this is real scraping/parsing/normalization work, not a data copy.
- [ ] Design the ability DSL/interpreter that `ability-scripting-engineer` uses to encode card text as executable effects hooked into the Phase 1 trigger stack.
- [ ] Fully implement the Core Set as the first vertical slice: all five heroes' full decks, the Core Set encounter set, Rhino/Klaw/Ultron as villains, both scenario sides where applicable.
- [ ] Exit criteria: the Core Set is 100% represented as data + ability scripts, and a full game can be played headlessly using only real card content (no stub/fake cards).

## Phase 3 — Encounter & villain AI

Owner: `encounter-ai-designer`.

- [ ] Villain AI decision logic for scheme/attack selection, minion activation order, and any villain-specific "choose the worst option for the players" rules text.
- [ ] Encounter deck draw/resolution flow, boost deck mechanics (boost icons on villain cards), modular set behavior.
- [ ] Exit criteria: the AI opposition plays a legal, rules-correct game against scripted player input with no human needed to operate the villain side.

## Phase 4 — Client UI/UX

Owner: `game-client-engineer`.

- [ ] Board layout: player area(s), villain area, main scheme, side schemes, encounter deck/discard, each player's identity/hand/deck/discard/play area — legible at a glance the way the physical table is.
- [ ] Card rendering (using licensed-for-personal-use art per the IP boundary in CLAUDE.md), zoom/inspect, legal-move highlighting, drag-and-drop or tap-to-target interaction for choosing targets/attachments/assignments.
- [ ] Animations/feedback for damage, threat, defeat, phase transitions — enough to make state changes readable, not spectacle for its own sake.
- [ ] Accessibility pass: colorblind-safe indicators (damage/threat/keywords shouldn't rely on color alone), readable type sizes, keyboard/controller navigation if platform requires it.
- [ ] Exit criteria: a solo human player can play a full Core Set scenario against the AI villain from the Phase 3 engine, entirely through the UI, with no engine internals exposed.

## Phase 5 — Multiplayer

Owner: `multiplayer-netcode-engineer`.

- [ ] Authoritative game state (server or host-authoritative — pick based on Phase 0 stack) with clients as thin views + input senders.
- [ ] 1–4 player co-op session flow: lobby/matchmaking-lite, turn order enforcement, simultaneous-action windows where the rules allow them (e.g. players may act in any order during their own turns but some effects have priority rules).
- [ ] Reconnect/resume handling — a dropped player shouldn't corrupt or stall the game state.
- [ ] Exit criteria: 2–4 players can complete a full scenario together over a network with correct turn/priority enforcement.

## Phase 6 — Rules QA & regression testing

Owner: `rules-qa-engineer`, in collaboration with `game-rules-architect`.

- [ ] Build a scenario-test suite where each test encodes a specific FAQ ruling or RRG clarification (link the ruling in the test) and asserts the engine produces that exact outcome.
- [ ] Replay-based regression testing using the Phase 1 game log format — capture real playtest sessions as fixtures.
- [ ] A drift-detection process: when `content-release-tracker` reports a new errata/FAQ entry, a corresponding test should be added or an existing one flagged for review.
- [ ] Exit criteria: CI (or local equivalent) runs the full rules-QA suite on every engine change.

## Phase 7 — Content expansion beyond Core Set

Owner: `card-data-pipeline` + `ability-scripting-engineer`, tracked by `content-release-tracker`.

- [ ] Cycle 1 (The Rise of Red Skull) as the next full content pass, then subsequent cycles/campaign boxes in release order.
- [ ] Each new cycle's new keywords get added to `game-rules-architect`'s keyword set before that cycle's cards are scripted.
- [ ] Ongoing: `content-release-tracker` watches for new releases/errata/taboo changes and files content-pipeline work rather than letting the card pool go stale.

## Phase 8 — Polish

- [ ] Tutorial/onboarding flow for players unfamiliar with the paper game.
- [ ] Save/resume, settings, difficulty (standard/expert per the paper game's modes).
- [ ] Audio/feedback pass, performance pass, platform packaging as decided in Phase 0.

## Non-goals (for now)

- No deckbuilding marketplace, no online ranked ladder, no monetization — this is about a faithful, playable simulation of the paper game, not a live-service product.
- No attempt to reimplement every cycle on day one — breadth comes after Phase 1–2 prove the engine approach is right on a small, well-understood card pool.
