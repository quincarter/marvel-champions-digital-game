# PLAN: Marvel Champions Digital Edition

Status: **Phases 0–3 complete; Phase 4 (client) in progress — a Core Set scenario is playable through the UI with card art, a player-chosen payment, an Inspect sheet, a phone tab bar, readable state-change beats, keyboard navigation, the villain-phase walkthrough screen, abilities on cards in play, a payment strip that reaches resources in play, a standing warning when saving fails, a scrolling game log, your deck and discard as piles on the table, and keyboard and gamepad on every screen; the win screen has now been seen in a browser. The RRG 1.8 unique-card rule is now enforced engine-wide.** Client stack: pure Phaser 4 (4.2.1) with rexUI available behind an `Mc*` widget layer, no DOM UI framework (see Phase 4). Phase 2: Core Set ingestion, the §3 engine primitives, the `@mc/cards` ability DSL, all 233 Core ability scripts, `coreScenario()` builders, and real-content e2e games (spec: [docs/phase2-core-set.md](docs/phase2-core-set.md)). **Phase 3: the villain phase lives in `packages/engine/src/villain/`. Every decision the villain side leaves open is routed to the player the RRG names, and tagged with a `PendingChoice.authority`. `auditVillainPhases` independently re-checks each villain phase of a recorded game. 48 scripted games plus 3 passive-table games play to an outcome with clean audits (spec: [docs/phase3-encounter-ai.md](docs/phase3-encounter-ai.md)).** **Phase 4 so far: `legalActions` and the `paymentFor`/`tryPayment` payment query in the engine; and in `@mc/client` the `EngineHost` (worker + in-thread), the session store, the plain-TS view models (layout, board model, highlights, game log, villain-phase walkthrough, inspect, payment, tab badges, beats, focus) with 98 Vitest tests, the design-token module, the `Mc*` widget layer, the card-art pipeline, and the Boot → Title/Setup → Board → Game Over scenes with the pending-choice and Inspect overlays.** Stack recorded in CLAUDE.md; monorepo scaffolded (`packages/engine`, `packages/content`, `packages/cards`, `packages/client`); card schema landed in `@mc/content` (see its README for the rules-shape decisions); `pnpm test` / `pnpm typecheck` green (653 tests). **Phase 9 (decks: precons, MarvelCDB import, an in-app deck builder) was added 2026-09-12** and re-scopes deckbuilding back in; it is numbered last but depends only on Phase 4, so it can start before Phases 5–8. Update the Status line and check off phases as work lands.

This plan is intentionally sequenced rules-engine-first: a correct, headless simulation of a small card pool (the Core Set) before any UI polish, AI sophistication, or content breadth. A beautiful board that plays the game wrong is worse than an ugly board that plays it right.

## Phase 0 — Foundations & decisions

Owner: whoever kicks off the project (architectural decisions, not yet delegated to a single agent).

- [x] Presentation style: **decided.** This plays like the *Sentinels of the Multiverse* digital game — a 2D tabletop-style card game (flat board, zones, cards as first-class rendered objects, hand fanned at the bottom, drag/tap to play), not a 3D Tabletop-Simulator-style physical sim and not a card-browser/wiki-with-images website. It should feel like sitting at the table: cards, tokens, and zones you can inspect and manipulate directly, with clean digital-native UI chrome (phase tracker, action log, threat/damage counters) layered around that tabletop, the way Sentinels' digital client does. This is a rendering/interaction style decision, owned by `game-client-engineer` once Phase 4 starts — it doesn't change the engine architecture below.
- [x] Pick the tech stack — **decided, see "Tech stack" in CLAUDE.md.** TypeScript (strict) + pnpm workspaces + Vitest; single cross-platform client (web-first, packaged to desktop/mobile later) over a platform-agnostic engine package; local-only persistence until Phase 5.
  - Target platform(s): **playable on any platform** (the point of reference is Sentinels of the Multiverse's digital edition, which ships to web/desktop/mobile from one client).
  - Client framework and the desktop/mobile wrapper (Tauri/Capacitor/etc.) were deliberately deferred to Phase 4 and Phase 8 respectively — nothing in Phases 1–3 depends on them. **Client framework decided at the start of Phase 4: pure Phaser 4 + rexUI** (see Phase 4). The wrapper is still a Phase 8 choice.
- [x] Scaffold the repo: `packages/engine` (`@mc/engine`), `packages/content` (`@mc/content`), `packages/client` (`@mc/client`), dependency direction strictly `client → engine → content`.
- [x] Tests-as-first-class: Vitest wired into every package, `pnpm test` / `pnpm typecheck` run from the root.
- [x] Define the card data schema — landed in `packages/content/src/schema/` (`AnyCard` union, structured keywords, `ScalingValue` for per-player numbers, printed-vs-current text for errata, `AbilityReference` slots for `ability-scripting-engineer`, `ArtRef` keys only for art). Open item carried into Phase 2: the `discount` keyword is a stub — its semantics weren't on the Hall of Heroes keyword page yet and must be confirmed against the RRG/card text before any card uses it.

## Phase 1 — Core rules engine (headless, no content yet)

Owner: `game-rules-architect`.

- [x] Game state model — `packages/engine/src/state.ts`: plain serializable `GameState`, every physical card a `CardInstance` with an `InstanceId` distinct from its content `CardId`, zones as data, seeded RNG in state, `pendingChoice` slot for player decisions.
- [x] Turn structure state machine — `flow.ts`: Player Phase (turns → end-of-phase discard/draw/ready, per RRG these are end-of-*phase*, not end-of-turn) → Villain Phase (place threat → villain + minion activations per player → deal → reveal → pass first player). Defend is a `PendingChoice`. Villain attack/scheme by form, boost cards dealt before the defender is declared and flipped after.
- [x] Effect/trigger stack — `stack.ts` + `resolve/` (one module per frame kind, `resolve/index.ts` is the entry point): `state.stack` of plain-data frames (event / window / ability / effects / enemyAttack / enemyScheme / reveal / playCard), each with an explicit cursor so resolution suspends on a `PendingChoice` and resumes. Timing windows follow the RRG 1.8 "Ability — Simultaneous Timing Priority" chart (p.5); simultaneous forced effects are ordered by the first player. Abilities are engine-side data (`AbilityDefinition` = trigger + cost + limit + `EffectSpec[]`) supplied through `EngineDeps`, keyed by the `AbilityId` on `@mc/content` cards.
- [x] Core keyword semantics implemented against the state machine, all keyed off the `KeywordInstance` list on the `@mc/content` card rather than per-card code (`keywords.ts` is the lookup layer; the rules live where the game action resolves). Landed: Guard, Overkill, Retaliate X, Peril, Surge, Toughness, Restricted, Quickstrike, Uses X, Villainous, Ranged, Piercing, Stalwart, Steady, Permanent, Setup, Incite X. Deliberately **not** implemented (post-Core cycles, add with their cycle per Phase 7): Alliance, Teamwork, Requirement, Discount, Vulnerable, Hinder, Patrol, Amplify, Find, Assault, Temporary, Team-Up, Victory.
- [x] A game log / replay trace — `engine.ts`: `applyCommand(state, command) → {state, events}` is pure; `GameLog {initialState, commands}` + `replay()` reproduces state deterministically (tested with deep-equal).
- [x] Exit criteria: the engine runs full games headlessly from `createGame` to an outcome — `e2e.test.ts` plays a 4-round 2-player game to a villain-defeated win and a 3-round solo game to a main-scheme loss, using only `src/testing/` stub cards, and replays both logs to an identical final state.
- Known deviations carried forward (fix when a real card or a `rules-qa-engineer` test needs them): **Peril** only marks `PendingChoice.soleDecider`; the "other players cannot play cards or trigger abilities" half is not enforced in optional windows. **Retaliate** resolves during the attack's apply stage, ahead of other responses to the same attack, rather than being ordered with them by the first player. **Overkill** spill now resolves *after* the defeated character's When Defeated abilities: since Phase 2 the spill is dealt when the (interruptible) defeat event applies, and not at all if an interrupt replaces the defeat. The RRG is silent on the order. Optional abilities on *encounter* cards are offered to the first player only.

## Phase 2 — Card content pipeline & vertical slice

Owner: `card-data-pipeline` for ingestion/schema, `ability-scripting-engineer` for turning text into behavior.

- [x] Schema follow-ups surfaced by Phase 1 — landed 2026-09-10; final shapes and deviations in docs/phase2-core-set.md §1 (plus `PrintedStat` "—"/"X", main scheme stage names, blank-text allowance). Original list: `AbilityReference.trigger` in `@mc/content` can't express `resource`, `whenDefeated`, or forced-vs-optional — align it with the engine's `AbilityTriggerSpec` or make the engine registry authoritative and drop the field; add a `scaling(base, perPlayer)` helper beside `flat`/`perPlayerOnly`; `HeroIdentityCard.keywords` is card-level but some keywords are per face; `AttachmentCard` has no field for printed ATK/SCH/THW modifiers and `attachesTo` gives no host-choice hint; `MinionCard`/`AttachmentCard` have no `ResourceIconCounts` for typed costs. Engine side: `EffectSpec.putIntoPlay`/`chooseTarget` can only reach cards already in play, so "put a card from hand/deck/discard into play" is unexpressible; `enterPlayOnReveal` for Setup-keyword attachments always attaches to the villain.
- [x] Build the ingestion tooling that turns source material (card database pages, keyword list, rulings) into the structured schema from Phase 0 — this is real scraping/parsing/normalization work, not a data copy. `packages/content/scripts/ingest-marvelcdb.ts` (MarvelCDB API → art-stripped raw cache → normalized `packages/content/src/data/core/`), hand corrections cross-checked against Cerebro/printed cards and recorded in `curation/core.ts` + `provenance.ts`; see the content README.
- [x] Engine effect vocabulary for the Core Set (`game-rules-architect`, docs/phase2-core-set.md §3.1–§3.9): every Core mechanism is expressible as plain-data `AbilityDefinition`s. Tests: `resources`, `attacks`, `replacement`, `lasting`, `player-cards`, `enemy-actions`, `scenario-flow`, `drones`, `dash-stats` `.test.ts`.
- [x] Design the ability DSL/interpreter that `ability-scripting-engineer` uses to encode card text as executable effects hooked into the Phase 1 trigger stack — `packages/cards/src/dsl/` (builders compile to plain-data `AbilityDefinition`s; `defineAbilities` validates shape and slot/var binding order).
- [x] Fully implement the Core Set as the first vertical slice: all five heroes' full decks, the Core Set encounter set, Rhino/Klaw/Ultron as villains, both scenario sides where applicable — `packages/cards/src/core/`, 233/233 refs.
- [x] Exit criteria: the Core Set is 100% represented as data + ability scripts, and a full game can be played headlessly using only real card content (no stub/fake cards) — `packages/cards/src/e2e.test.ts`.
- Known deviations / unconfirmed rulings (Phase 2 engine primitives; see docs/phase2-core-set.md §3 for what landed):
  - **Heal as a cost** ("heal 1 damage from Captain Marvel →", Rechannel) needs at least that much damage on the identity. This is the literal reading of RRG "Cost" (costs are paid in full), not a confirmed FAQ ruling.
  - (Fixed in §3.9) Played events now move to a per-player `resolving` zone, out of play while they resolve (RRG "Event"), and are discarded afterward. Earlier they stayed in hand during resolution.
  - **Setup-keyword attachments** with a host that needs a choice attach to the first legal host in stable order. Setup has no choice point yet; none in Core need one.
  - **Wild resources and "paid using [X]"**: the engine assumes the payer declares each wild favorably. A single wild could satisfy two different "paid with" checks on one card; no Core card has two.
  - **"Spend X [type]"**: X counts every resource in the payment usable as that type, beyond the ability's fixed resource cost. A deliberate overpay can't be split off.
  - **Crisis** blocks threat removal from the main scheme when the source is a player card or has no source. Removal by encounter cards is still allowed.
  - **"At the end of this attack"** effects run after the attack's response window, just before the attack event leaves the stack.
  - **Keyword/trait grants** from constant abilities are seen wherever the engine has the ability registry (damage, retaliate, guard, statuses, uses, permanent, restricted, trait queries). The quickstrike, setup-keyword, and peril checks read printed keywords only; no Core card grants those. A trait grant whose own target filters by trait only sees *printed* traits (recursion guard).
  - **Ally limit** was listed under Phase 1 keyword/limit coverage but wasn't implemented; it landed in Phase 2 §3.3.
  - **(Fixed 2026-09-12, see "The unique-card rule" below.) The "unique" rule was not enforced for anything but identities** (found 2026-09-12). RRG "Unique": *"A card with a ✦ icon before its title is unique. The players as a group are permitted to have only one copy of each unique card (by title) in play."* `BaseCard.unique` is read nowhere in `packages/engine/src` — the flag is set in the card data (48 Core cards, 16 of them allies) and never consulted. This is **reachable in the first game anyone plays**: Mockingbird and Nick Fury are in all six Core starter decks, so any two-player table can put two copies of a unique ally into play. What Phase 2 §3.3 implements under `no_valid_target` is a different rule — `playRestrictions.maxPerPlayer` / `maxPerHost`, printed card text ("Max 1 per player"), correctly scoped per-controller and not to be changed. Fixing unique properly needs: a check in `playCard`; the same check on the `putIntoPlay` effect path (Make the Call pays from *any* player's discard, so a copy can arrive while one is in play); the RRG's two ally carve-outs, which need `BaseCard.subtitle` populated and trustworthy; and `legalActions` surfacing it so the client greys the card instead of letting the player click into an error. **Open ruling first:** the RRG states the permission but not the *resolution* when a second copy would enter play by a non-play effect — card-play is simply not a legal play, but the Make the Call path needs a cited FAQ answer rather than a guess.
  - **Who "you" is on encounter and scenario cards** (they have no controller): the revealing player for When Revealed; the attacked or scheming player for Boost; the engaged player for a minion's When Defeated; the first player for main-scheme and villain abilities (setup, stage When Revealed, side-scheme When Defeated). A triggered ability on an encounter card with `playerIs: "controller"` resolves for the player the event is about (the attacked player with `usesAttackedPlayer`). RRG "Ability" / "You, Your" support this for the common cases; the first-player fallback is a convention.
  - **Whirlwind** ("also resolve his attack against each other hero") is scripted as `atEndOfAttack` extra attacks flagged `additionalResolution`. The attacking enemy's own "when it attacks" abilities don't trigger for those, which prevents the loop. Unconfirmed: the RRG doesn't say whether the extra resolutions are separate attacks for other cards' triggers (the engine treats them as attacks for everything except the attacker's own abilities).
  - **Highway Robbery's cards are tucked facedown**, following the card text. RRG "Tuck" places tucked cards faceup; `tuckCards.facedown` follows the card.
  - **"Different resource types"** (The Vulture's Plans) counts wild as its own type. Unconfirmed.
  - **Setup-keyword attachments** attach while setup walks the encounter deck in order, so an attachment whose host (e.g. "the Ultron Drones environment") comes later in the deck finds no host and is discarded. Core has none with the setup keyword; if one appears, put setup cards into play in two passes, non-attachments first.
  - **"Would" interrupts are not yet ordered ahead of plain interrupts** to the same event (RRG "Would"). Both resolve in the same window tiers (forced before optional, first player orders the forced ones). Prevention/replacement cards are correct on their own; only ordering between a "would" and a non-"would" interrupt to the same event can differ.
  - **"(defense)" ability used while an attack is being initiated**: the identity becomes the labeled defender, and during Declare Defender only that hero may still make a basic defense (RRG "Defend, Defense"). A declined basic defense keeps the labeled defense, so the attack is not undefended.
  - Readings chosen while scripting the Core Set (`@mc/cards`; revisit if an FAQ says otherwise):
    - **"Your hero" on encounter cards while you're in alter-ego form** resolves against your identity (Sweeping Swoop's stun, Titania's Fury's attack, Ritual Combat / Electric Whip Attack / Under Attack damage, Sonic Boom's boost exhaust). "Heroes" in Explosion and "each hero" (Shocker, Rhino III, Whirlwind's boost) mean hero-form identities only.
    - **Masters of Mayhem** ("each Masters of Evil minion attacks the hero it is engaged with"): minions engaged with an alter-ego player attack that player too.
    - **Yon-Rogg's Treason** ("discard each [energy] resource from your hand"): each hand card with a printed [energy] resource icon; a wild icon doesn't count.
    - **Assault on NORAD** ("after placing threat here during step one"): only step one's own placement triggers it; the "place 2 threat here" it causes doesn't retrigger it.
    - **Obligations**: "you may flip to alter-ego form" is a card-effect form change (not the once-per-round flip), offered only in hero form; "exhaust [alter-ego] →" is choosable only while your identity is a ready alter-ego; the second bullet is always choosable (it always discards the obligation), e.g. Affairs of State with no Black Panther upgrade.
    - **Black Cat** triggers on being *played* ("After you play"), not on Make the Call putting her into play. **Interrogation Room**'s "you defeat" means the defeating damage came from a card you control (attack or not).
    - **Hawkeye**'s "enters play with 4 arrow counters" is a forced response to his own entering play (no Core card responds to him entering first). **Hulk**'s [mental] discard is skipped if his own [energy] damage already defeated him; his [energy] damage hits every character, friendly ones and Hulk included.
    - **Genetically Enhanced**'s "if there are no minions in play, this card gains surge" is checked when it's revealed (after it fails to attach). **First Aid** "any character" includes enemies. **Encounter-card Hero Actions** (Enhanced Ivory Horn, Sonic Converter, …) are usable by any player on their turn.

## Phase 3 — Encounter & villain AI

Owner: `encounter-ai-designer`.

- [x] Villain AI decision logic — `packages/engine/src/villain/` (docs/phase3-encounter-ai.md):
  - The villain never chooses. Attack vs scheme follows the player's form. The villain activates once per player in player order, then that player's minions activate.
  - Open decisions go to the player the RRG names: "choose" → the resolving player; several eligible targets for an encounter card → the first player; simultaneous effects → the first player orders them. No Core card has "the worst option for the players" text.
  - `PendingChoice.authority` (`player` / `firstPlayerTargets` / `firstPlayerOrders`) records which rule applied.
  - New `orderEnemies` choice for effects where "each X attacks/schemes".
  - Attachment host ties and Caught Off Guard / Masters of Mayhem now go to the first player.
- [x] Encounter deck draw/resolution flow, boost deck mechanics, modular set behavior. The engine mechanics landed in Phases 1–2. Phase 3 moved villain phase steps 1–5 into `villain/phase.ts` and added `auditVillainPhases`, which re-checks them from a game log on its own terms: step order, acceleration, activations per player/form, boost recipients and flips, cards dealt per hazard icon, reveal order, the first player token, decision authority.
- [x] Exit criteria: `packages/cards/src/villain-ai.test.ts`.
  - 48 games (Rhino/Klaw/Ultron × standard/expert × 1–4 players × 2 seeds) played by scripted players to an outcome, each with a clean villain-phase audit and an identical replay.
  - A passive table (end turn, take the minimum) loses to each scenario with no villain-side input.
- Readings carried forward (docs/phase3-encounter-ai.md "Readings"):
  - **Minion activation order** is the engaged player's choice; the RRG is silent on it.
  - **Caught Off Guard** is read literally under RRG "First Player", so the first player picks which of the revealing player's upgrades/supports is discarded.
  - **Identical enemies** (facedown Drones) are still offered for ordering.

## Phase 4 — Client UI/UX

Owner: `game-client-engineer`.

### Stack decision: pure Phaser 4 + rexUI

Decided 2026-09-11. It was first decided as a Phaser table inside a Lit app, then revised the same day. `@mc/client` is a Vite + TypeScript app built on **Phaser 4** (released 2026-04-10; pinned to `^4.2.1`, the current line — 4.1.x was the plan of record before 4.2 shipped, and `phaser4-rex-plugins@4.2.0` tracks 4.2). Its UI toolkit is **rexUI**, via the `phaser4-rex-plugins` package. Phaser draws every screen, the table and every overlay; there is no DOM UI framework.

- **Why.** A unified game feel was prioritized over DOM convenience:
  - one rendering model;
  - drag and tweens that work anywhere on screen;
  - screen transitions that feel like the table itself;
  - native keyboard and gamepad input.

  This is the closest match to the *Sentinels of the Multiverse* reference, whose UI is drawn by its game engine.
- **Not chosen for performance.** The game is turn-based with a few dozen cards on screen, so any of the options runs comfortably. The DOM would actually render the text-heavy screens (game log, inspect overlay, deck builder) a little more cheaply.
- **Accepted costs:** text-heavy UI, scrolling lists, text input and responsive layout are all built by hand in Phaser.
- **Considered and set aside:**
  - Phaser table + Lit DOM chrome: better for text and development speed, but has a canvas/DOM seam.
  - Pixi: a leaner renderer, but no built-in loader, tweens, input or scene lifecycle.
  - PhaserJSX (UI toolkit): React-like, TypeScript-first, flexbox layout — a good model, but brand new (July 2026, still gathering feedback). A candidate to swap in later behind the widget layer.
  - Phaser PixUI (UI toolkit): built around integer scaling for pixel art, which is the wrong fit for card scans.
  - Phaser 3-era UI plugins: no Phaser 4 support.

**Architecture rules**

- **Phaser is a view, never an authority.** No game rules, legality checks or game state live in Phaser scenes. The engine's `GameState` is the only truth.
- **Scenes are navigation.**
  - Screens: Boot/Preload, Title, Scenario, Seats, Deck, Board, Game Over.
  - Overlays run in parallel over Board (`scene.launch`), so the board stays alive underneath: Inspect, Pending Choice, Payment, Pause, and the villain-phase walkthrough.
  - Don't use Phaser physics.
- **One store, one dispatch.**
  - A plain TypeScript session store with no Phaser imports holds the latest read-only copy of the game (from the engine host, below). Scenes subscribe to the store.
  - Every command goes through a single `dispatch` to the engine host, which applies it with `applyCommand` and keeps the session log replayable.
  - The Board scene reconciles from state, keeping a map from each card's instance id to its game object. It uses the engine's `GameEvent`s to decide what to animate (damage dealt, threat placed, card moved) with Phaser tweens.
- **The engine runs in a Web Worker, behind an async `EngineHost` (decided 2026-09-11).**
  - **Why:** `legalActions` is too slow for the main thread. In the 4-player Ultron game it took 184 ms at the 95th percentile (194 ms worst), about 11 frames at 60 fps. `applyCommand` is usually fast (4.4 ms at the 95th percentile) but peaks at 21 ms. Copying the state to a worker is cheap: 205 KB, about 1 ms; without the card pool, 68 KB and about 0.4 ms.
  - **The interface:** `EngineHost` offers async `dispatch(command)` and `legalActions(playerId)`, plus a subscription for updates. The store, view models and scenes only ever talk to it.
  - **Two implementations:** a worker host for the game (a Vite module worker; Comlink optional for the calls between threads), and an in-thread host for Vitest and debugging.
  - **The worker holds the game.** It keeps the `GameSession` and log and applies commands. It sends the Core card pool once at startup; each update then carries the new state without `cardPool`, that command's `GameEvent`s, and a version number (the command count). The client discards any result for an older version.
  - **Legal moves are computed ahead of time.** After every state change, the worker computes `legalActions` for the player who must act (the active player, or the player a choice is addressed to) and sends it with the update, so highlighting is ready before the player looks.
  - **Board input is locked while a command is in flight.** The game is turn-based, so this is invisible, and tweens keep running because the main thread stays free.
  - **Phase 5:** the same async interface is what a host- or server-authoritative multiplayer setup needs, so the worker acts as a local server and a network host can replace it without changing the client.
  - Web workers run inside Tauri and Capacitor, so the Phase 8 packaging choice isn't affected.
- **Thin scenes, plain-TS view models.** Logic lives in plain TypeScript that Vitest can test without a canvas: what's highlighted, what a zone holds, log lines built from events, zone layout rectangles. Scenes only draw it.
- **UI toolkit: rexUI behind our own widget layer.**
  - Install `phaser4-rex-plugins` and register `RexUIPlugin` (`phaser4-rex-plugins/templates/ui/ui-plugin.js`) as a scene plugin. Type declarations come from `phaser4-rex-plugins/templates/ui/ui-components`.
  - Scenes never call rexUI directly. A thin widget layer (`McButton`, `McPanel`, `McScrollList`, `McTabs`, `McDialog`, `McTextInput`) wraps it and implements the `Components.dc.html` state matrix: rest / hover / selected / unavailable, solid border = available vs dashed = not yet real, 40% ink = illegal right now, the red selection ring. Keeping scenes on the wrappers leaves the toolkit swappable.
  - What rexUI covers:
    - **sizers** (sizer, grid sizer, fix-width, overlap) for the three form-factor layouts;
    - a **grid table** for the virtualized game log and deck lists;
    - a **scrollable panel** and **text area** for long rules text in Inspect;
    - **tabs** for the phone board's zone tabs;
    - **dialogs** for pending-choice, payment and pause;
    - **buttons**, menus and grid buttons;
    - **text input**.
  - rexUI's API is configuration-heavy JavaScript, so styling it to the design tokens is manual work; the wrappers are where that lives.
- **Text.**
  - Set text resolution to the device pixel ratio so it stays sharp.
  - Use bitmap text for fast-changing numbers (HP, threat, counters).
  - Load Bangers, Public Sans and IBM Plex Mono before any text is drawn.
  - Virtualize the game log (only on-screen lines exist as objects).
  - Rules text longer than two sentences goes to the Inspect overlay, never onto the table (a rule in the design sheet).
- **Text input** (seed, deck names) uses rexUI's input components through `McTextInput`. Its DOM-backed input is the only DOM in the app.
- **Layout per form factor.**
  - The scale manager runs in resize mode. A layout module computes zone rectangles for phone (390×844), tablet (1024×768 landscape, 768×1024 portrait) and desktop, as pure, testable functions.
  - **Phone board (decided 2026-09-11): one Board scene with a container per zone.**
    - The tab bar (Threat · Enemies · Me · Team · Log) is `McTabs`. Picking a tab shows that zone's container and lays it out full-width.
    - The hand and action bar stay fixed at the thumb on every tab.
    - Reconciliation stays in the single Board scene, the same as tablet and desktop.
    - A card moving to a zone on a hidden tab flies into that tab's button, and the button shows a change badge, so off-screen changes still read.
    - Set aside: panning a camera over one large virtual table (doesn't match the list-style phone mocks, and needs two cameras) and one scene per tab (duplicate reconciliation, no animation between zones).
- **Accessibility.**
  - Covered:
    - colorblind-safe indicators (icon plus text, never color alone);
    - the design sheet's minimum type sizes and touch targets;
    - full keyboard and gamepad navigation with a visible focus ring;
    - reduced motion (an in-game setting, defaulting from `prefers-reduced-motion`).
  - **Screen readers are not supported,** because a canvas is invisible to them. Adding support later would mean a hidden HTML mirror of the board.
- **One set of design tokens.** The palette and type rules from `Components.dc.html` live in a single TypeScript token module as hex numbers and font specs.
- **Card art.** Scans come from the gitignored `assets/card-art/` folder, found through each card's `ArtRef` key.
  - Load them per scenario, downscaled to table size.
  - A missing scan falls back to a generated frame, matching the designs' art slots.
  - Scans are for personal, non-commercial use and never committed (CLAUDE.md).
- **Performance guardrails.**
  - Pack UI chrome into texture atlases.
  - Cap live text objects (virtualized lists, cached wrapped text).
  - Use the WebGL renderer.
- **Packaging.** WebGL runs fine in both Tauri and Capacitor, so this choice doesn't constrain the Phase 8 wrapper.

### Design source

`Marvel Champions game screens/`, a set of Claude Design canvases:
- **`Components.dc.html`** — the design system: 5 surfaces, 1 accent, 4 signal colors, an ink opacity ladder, Bangers/Public Sans/IBM Plex Mono type rules, state matrix, selection ring. It also sets rules such as "no gradients, no shadows" and "hover never moves or scales".
- **`Board - Long Table` / `Board - Phone`** — the board.
- **`Screens - Desktop` / `Tablet` / `Phone`** — the full session flow: title → scenario → heroes → deck → table → setup deal → board → villain phase → overlays → game over.

The mocks' card text is placeholder. The client must render every name, stat and rules text from `@mc/content`. Several mocks don't match the Core Set: Ms. Marvel and Thor aren't Core heroes, Sonic Boom's text is invented, Klaw's "SCH 14" is wrong, and so is Defense Network's "+1 DEF".

### Engine and scope work the designs call for (settle before or early in Phase 4)

- [x] **Legal-moves query in `@mc/engine`** (`game-rules-architect`; decided and landed 2026-09-11 in `packages/engine/src/legal.ts`, exported as `legalActions`).
  - **How it decides:** it probes each candidate command through the pure `applyCommand`, so the engine's own handlers decide legality and nothing restates a rule. Every reason code and "Why illegal?" message is the engine's own.
  - Each legal entry carries an `example` command the engine accepts, with the smallest working payment found (resource abilities first, then hand cards by resources, resource cards first on ties), and a `needsPayment` flag.
  - Outside the player's turn it returns `choice` (with the open `PendingChoice`), `notYourTurn` or `gameOver` instead.
  - **Rules fix found while building it:** `playCard` accepted an interrupt- or response-only event as an action, paying its cost for no effect. It is now rejected with `card_type_not_playable` (RRG "Event"). Events with an action ability, and ability-less stub events in tests, are unchanged.
  - **Timing:** 5–8 ms per call in the Rhino and Klaw games; in the 4-player Ultron game, 184 ms at the 95th percentile and 194 ms worst. It runs in the engine worker, computed ahead of time after each state change (see "The engine runs in a Web Worker" above), so the main thread never waits on it. A cheaper affordability check than a full probe per payment prefix is a nice-to-have, not a blocker.
  - `legalActions(state, playerId, deps)` returns:
    - **plays:** cards in hand that can be played now, with their legal attachment hosts and whether the player can afford them;
    - **abilities:** action and resource abilities usable now;
    - **basic actions:** attack or thwart (with legal targets), recover, change form, end turn;
    - **illegal actions:** every candidate that is illegal, with the engine's `EngineErrorCode` (`wrong_form`, `already_exhausted`, `already_changed_form`, `insufficient_resources` for "can't afford", `limit_reached`, `card_type_not_playable`, `no_valid_target` — the last covering guard, crisis, restricted and max-copies, which the message tells apart) and the engine's message.
    - **blocked targets:** targets that exist but are illegal right now, with their reason, e.g. the villain behind a guard minion.
  - It feeds "Legal now: 3 plays · 2 abilities", "Why illegal?" and legal-move highlighting.
  - **Payments are not enumerated.** The query only answers "affordable?"; the Payment overlay has the player pick the actual cards and resource abilities, and `applyCommand` stays the final judge.
  - **Pending choices need nothing new:** `PendingChoice.options` already lists every legal answer.
  - **Rules stay out of the client** ("Phaser is a view"). Today only the test driver finds legal moves, by trying commands against `applyCommand`; the client must not copy that.
  - **Tests:**
    - `packages/engine/src/legal.test.ts` (stub cards): turn and choice reporting, wrong form, can't afford, guard-blocked targets, exhausted hero, response events.
    - `packages/cards/src/legal-actions.test.ts` (real Core games: Rhino solo, Klaw 2 players, Ultron 4 players): at every player-turn state, the command the independent greedy driver actually issued is listed as legal with its target, and every listed example is accepted.
- [x] **Villain phase as a walkthrough** — the view model landed in `packages/client/src/view/villain-walkthrough.ts`. `appendWalkthrough` folds each command's `GameEvent`s into the five RRG steps, tracked from `stepChanged`; events outside the villain phase are ignored, and a new phase clears the previous round's beats (the screen shows one phase at a time) while beat ids keep counting so a list can key on them. Beat wording is reused from the game log, so the log and the walkthrough never describe the same beat two ways. `pauseFor` stops on each `choiceRequested` and labels it from `PendingChoice.authority` (first-player targeting vs ordering vs the player's own decision), with the Peril note when `soleDecider` is set. `decisionLabel` is the same reasoning without the "auto-advance paused" framing, for the pending-choice overlay, which can be open in any phase. Tested against a real Rhino villain phase and a real Klaw mid-phase pause. **The screen landed 2026-09-12** — `scenes/villain-phase.ts`, launched by the Board on villain-phase step one. See "The villain-phase walkthrough screen" below.
- [x] **Hero seats: one human plays every seat** (decided 2026-09-11; landed).
  - Phase 4 supports multi-handed solo: one human controls 1–4 heroes, much as many people play the paper game solo.
  - **The board's perspective follows whoever must act:** the active player (`step.activePlayerId`) during turns, or the player a pending choice is addressed to (`pendingChoice.playerId`) while one is open.
  - Every `resolveChoice` is still issued as the player the engine names, so the command log stays identical to a real multiplayer game and Phase 5 needs no rework.
  - **The mocks' "Seat · AI" becomes "Seat · you".**
  - **Hero AI is not in Phase 4** (backlog item under Phase 8). Phase 3's villain side is procedure, not AI, and the greedy test driver isn't good enough to be a player-facing opponent.
  - **As built:** the Title/Setup screen seats 1–4 Core starter decks, all labeled "all played by you". `SessionStore.perspectiveId` follows `actingPlayer(state)` — the player a pending choice is addressed to, else the active player — and holds on the last actor while the engine is between choices, so the board doesn't blank out mid villain phase. `resolveChoice` reads the open choice's own `playerId`, so the command log is identical to the same game played by four people (asserted in `session-store.test.ts`).
- [x] **Out-of-scope screens in the mocks** — confirmed out of scope and not built *in Phase 4*. Campaign (marked locked in the mocks) stays out. **Collection/deckbuilding was re-scoped in (2026-09-12) and is now Phase 9** — precons, MarvelCDB import and an in-app deck builder — so the mocks' deck screens are a plan, not dead weight.

### What landed (2026-09-11)

`@mc/client` is a real app: `pnpm --filter @mc/client dev` boots it, `build` produces a 1.6 MB main chunk plus a separate 300 KB engine-worker chunk.

- **`EngineHost`** (`src/engine/`) — the async interface from the stack decision, with two implementations over one shared `EngineSessionCore`: `WorkerEngineHost` (a Vite module worker, request/response with echoed ids so replies may arrive out of order) and `LocalEngineHost` (in-thread, for Vitest and debugging). The card pool crosses once on `started` and is re-attached to every published state, so consumers get a complete `GameState` and every `@mc/engine` query helper works while updates stay pool-free. Updates are stamped with the command count, and anything older than what the store holds is dropped. `legalActions` for the player who must act is computed in the host after every state change, so highlighting is ready before the player looks.
- **`SessionStore`** (`src/store/`) — the single store and the single `dispatch`. No Phaser imports. A rejected command changes nothing and surfaces the engine's own message. `save()` returns the replayable log.
- **View models** (`src/view/`), all plain TypeScript, 54 Vitest tests, exercised against real Core games rather than fixtures:
  - `layout.ts` — `formFactorFor` plus zone rectangles for the Long Table and the phone board, and `cardRow`, which keeps the 2.5″×3.5″ ratio and overlaps rather than overflowing a zone.
  - `board-model.ts` — every panel, stat tile, scheme, hand card and seat row. Every modifiable number comes from the engine's `characterProfile` / `remainingHitPoints` / `scale`; the client never recomputes a stat. A printed "—" renders as a dash, not a 0. Crisis is read as a printed scheme icon, and a side scheme correctly reports no threshold.
  - `highlights.ts` — playable vs present-but-illegal hand cards, blocked targets, and the five action-bar buttons, each carrying the engine's own `EngineErrorCode` and message for "Why illegal?".
  - `log-lines.ts` — the design's numbered beats (`R3.4`) with status tags, struck through when a status is spent. Engine bookkeeping (stack frames, timing windows, trigger announcements) is dropped, so the log reads as an account of the table rather than an engine trace.
  - `names.ts` — names only ever from `@mc/content`; a facedown card reads as what it is treated as.
- **Design system** (`src/tokens.ts`, `src/ui/`) — every value transcribed from `Components.dc.html`: five surfaces, Hero Red, four signals, the three status hues, the ink opacity ladder, the 3/2.5/2px border depth model, the Bangers/Public Sans/IBM Plex Mono type roles, touch targets. `ui/theme.ts` implements the state matrix once (rest / hover / selected / unavailable; hover swaps ground and ink and never moves or scales); `ui/widgets.ts` is the `Mc*` layer scenes draw through.
- **Scenes** (`src/scenes/`) — Boot (waits on `document.fonts`, with a timeout so a slow font never dead-ends the game), Title/Setup (scenario · difficulty · seats · seed, one red CTA), Board, the pending-choice overlay running in parallel over Board, and Game Over.
- **Verified in the browser**: a Rhino solo game played through the UI — decline the mulligan, flip to hero, basic-attack Rhino for 2 (14/14 → 12/14, Spider-Man exhausted), with the log and the legal-move highlighting updating correctly at each step (hero-only cards become playable exactly when the flip happens).

Notes and deviations worth carrying:

- **The dot grid must be a tiled texture, not `fillCircle` per dot.** At the design's 6px spacing a 1280×800 table is ~28,000 dots; as Graphics geometry that overwhelms the renderer. `paintDotGrid` generates one `spacing`-sized texture and tiles it.
- **`Scale.RESIZE` with no `autoCenter`.** With RESIZE there is nothing to centre, and an autoCentre offset desynchronises pointer input from the widgets' interactive zones.
- **Text resolution is per-`Text` object in Phaser 4** (there is no game-level setting), so it is applied in `ui/theme.ts`, where every text object in the app is created.
- **Three screens are folded into one.** The mocks' Scenario → Heroes → Deck flow is a single Setup screen, since the preconstructed Core decks are the only deck choice in Phase 4. *(Revisited 2026-09-13: Phase 9 decks have landed, so the split is back on the table. See [docs/phase4-screen-gaps.md](docs/phase4-screen-gaps.md), W2.)*

### What landed (2026-09-12)

Six of the open Phase 4 items closed. Everything below is verified in the browser against a real Rhino solo game, not only in tests.

- **Card art** (`src/art/`, `vite-card-art.ts`). Every card, scheme, villain and identity face now draws its real scan.
  - **It has to be same-origin.** MarvelCDB serves the images `@mc/content`'s `ImageRef`s point at, but with no `access-control-allow-origin` header — so a cross-origin `<img>` decodes and then *cannot* be uploaded as a WebGL texture. `vite-card-art.ts` adds one route, `/card-art/<path>`, answered from the gitignored `assets/card-art/` first and from MarvelCDB second, writing through to that folder as it goes. A player's own scans dropped there win over the fetch, which is what `ArtRef` ("a key into a gitignored local asset folder") was always for. Nothing is committed (CLAUDE.md). It is a dev/preview-server route only: a production build 404s, and a 404 is a *supported* outcome — every card falls back to the generated frame, which is the designed behaviour for a missing scan.
  - **`art/art-source.ts` is pure** and answers "which picture is this face?", which is not one question per card: a hero identity has two faces, a villain a picture per stage, a main scheme an A and a B side per stage, and the schema puts the ref on whichever of those is its own printed card.
  - **Loaded lazily, per card, not per scenario.** A Core scenario touches a few hundred cards and shows a dozen; a preload would put a progress bar in front of the game. The board draws its frame, the scan arrives, the board redraws.
  - **The texture manager is the source of truth for "has it arrived".** A first version kept its own loading/ready/missing map and gated drawing on it; a scan could land in the texture manager while its entry stayed `loading`, and the table then drew the placeholder until some unrelated redraw fixed it. The cache now remembers only what it alone knows — what has been handed to the loader, and what came back 404 — and redraws on any file arriving.
  - MarvelCDB serves JPEGs under `.png` paths, so the route sniffs the bytes rather than trusting the extension.
- **Payment is the player's decision.** `paymentFor` / `tryPayment` landed in `@mc/engine` (`legal.ts`, by `game-rules-architect`): what may be spent, what each source is worth, the engine's own smallest working payment as the opening selection, and a single `applyCommand` probe as the only judge of whether a selection works (0.3 ms worst case, so it runs on the main thread). `view/payment-model.ts` holds the mode and `board.ts` draws it.
  - **It is a mode over the hand, not an overlay scene.** PLAN's scene list said Payment would be an overlay; `Board - Phone` disagrees, and the canvas wins: a red "PAYING 1 / 3 — Photon Blast → Klaw. Tap cards to spend." bar sits above a hand you tap, the card being paid for wears the ring, and everything unspendable dims in place.
  - **The bar has an explicit Pay, where the mock commits the moment the count fills.** A payment may legitimately exceed the printed cost — "spend X [energy]" counts every resource beyond the fixed cost (docs/phase2-core-set.md §3) — so auto-committing at the first sufficient selection would quietly take that choice away.
  - A hand card's pip count is the engine's, not `printedResources`: it already accounts for "double the resources this card generates while paying for an [aspect] card". One pool is not statically knowable — "equal to the top card of your discard pile" changes as the payment discards — and the engine's comment says so rather than inventing a number.
- **Inspect overlay** (`scenes/inspect.ts`, `view/inspect-model.ts`), opened by press-and-hold or right-click on any card, ◂ ▸ through the hand, Esc or a tap anywhere to dismiss. The card face on the left is entirely `@mc/content` — cost, name, type line, scan, full current wording, the *printed* wording whenever errata changed it, flavour, resource pips, set and collector number. "Rules & state" on the right is entirely the engine — its own sentence about why this card can or cannot be played right now, its legal targets, its keywords with their printed values.
  - **Fixed while building it: a card in your own hand was reported as facedown.** `CardInstance.faceup` describes the *table*, and a hand card is not faceup — but its owner is plainly looking at it. Visibility is now a question of zone (`view/visibility.ts`), shared by the game log and Inspect so they can't disagree: hands and discard piles are open, decks never are, everything else follows `faceup`. Phase 5 is where this stops being the client's business at all — a server must not send a card the player may not see.
  - Not built: the mock's "This card, this game" history panel.
- **The phone board has its tab bar.** `layout.ts` now gives the active tab's zones a rectangle and every other tabbed zone `null` — handing them all the *same* rectangle, as it did, meant the Board drew five zones on top of one another. Two tabs carry more than one zone, because on the table those are one thing: "Me" is the identity with the play area under it, "Enemies" carries the encounter piles in a strip above the enemies. `McTabs` draws the rail; `view/tab-badges.ts` counts what happened on the tabs you aren't looking at, keyed off *where the card is* rather than the event's name (damage is Enemies news on the villain and Me news on your hero), and looking at a tab clears it. The Log tab is never badged: every event is log news, so that badge would mean nothing.
  - Two phone bugs the tab work exposed and closed: the chrome bar overlapped itself at 375px (the phase toggle now drops out below 640px, since the step label already says the same thing), and the action bar crammed five controls into one row (it now stacks into the design's 44px abilities row over a 52px commit row). The Title screen also pushed "Start game" off an 812px screen — six 44px hero rows stacked — and now pairs them into two columns.
- **State changes are readable** (`view/beats.ts`). A beat is a number and a place: "−4" over the card that took it, "+2 THREAT" over the scheme, "TOUGH" where damage was prevented and the board therefore shows no change, "CRISIS" where a thwart was blocked and otherwise looks like a bug. Beats are held as data with a start time rather than as game objects, so a redraw mid-flight re-creates them at their anchor's new position instead of wiping them. Reduced motion keeps the beat and drops the travel.
- **Keyboard navigation** (`view/focus.ts`): arrows and Tab walk a stated focus route, Enter/Space acts, `I` inspects, Esc backs out of a mode, and the focus ring is the selection ring drawn static — a pulse means "the board is waiting for you", and focus is not a prompt. A canvas has no focus order of its own, so the order is a pure, tested function rather than something that emerges from the order of `#draw` calls. While a decision is open the route narrows to the answers: stepping through an action bar you cannot use to reach the one target you can is worse than no keyboard support. An *unusable* control still takes focus, because its "why illegal?" reason lives on it.
- **Two things that were simply missing from the table:** attachments are now drawn as named chips on their host, and an upgrade attached to your own identity shows in your play area — on the table those sit in front of you, and a card you played that vanishes is worse than one drawn in the wrong place.
- **The opening hand is now actually random.** The Title screen defaulted to a constant seed, so every new game dealt the same opening hand: the engine's shuffle was real, the randomness wasn't. The seed is rolled per visit and still shown, so a game can be replayed deliberately.

**Follow-ups after the first real play session (2026-09-12), all from scans being added locally:**

- **Villains and main schemes showed "no scan" in Inspect.** Inspect asked every card for its *front*, but a villain's picture lives on its stage and a main scheme's on its side — so exactly the two cards a player most wants to read had no art. `faceOf` moved out of the board model and is now shared, so the table and the sheet ask the same question.
- **Card scans are never cropped any more.** `contain` is the default fit. A scan is a whole card — frame, name, stat box and all — not a picture of a character, so cropping one does not produce artwork, it produces a card with its edges cut off, and that is what it looked like. `cover` survives for the one slot that is already the card's own shape: a hand card's 2.5:3.5 against a 300×419 scan, where the two fits are identical and neither loses anything.
- **A hand card is now the card.** The slot was already card-shaped, so the scan fills it exactly, and the scan prints the name, cost, type and rules text better than we can redraw them at 112px. The generated frame stays as the fallback for a card with no scan, and the chrome the scan *cannot* carry stays on top: the dim, the ring, and the engine's reason for refusing it.
- **Character panels match the scheme panels:** a whole-card thumbnail in a column on the left, live numbers beside it.
- **The Title screen and the choice sheet show cards.** Scenarios show their villain, hero seats show their identity, and a choice whose every option names a card — a mulligan, a discard — is presented as those cards rather than as a list of names. Thumbnail height is computed from the space actually left, and drops to text rows rather than shipping a card nobody can see.
- **The Title screen's pickers are one control each.** They were an art block with a separately-bordered button under it — two stacked rectangles read as two controls, and the bordered half looked like the only clickable one. `McCardTile` is now one bordered tile: card above, name below, one frame, one tap target. Its caption is *fitted* rather than allowed to run past the tile, and the number of cells across is chosen by **measuring the longest name** instead of guessing — at three across on a phone, "Captain Marvel (Leadership)" is wider than its own cell, which is what put labels on top of each other.
- **Tablet portrait uses the tabbed board, not the long table.** The design set's two boards are shaped by *orientation*, not by device: the Long Table spreads a villain band over a player band and needs width, `Board - Phone` stacks one zone at a time and needs height. A tablet held in portrait is 768×1024 — far closer to the phone's shape — and forcing it through the landscape layout gave it an 84px-wide game log and a main scheme too narrow to show its own card. `boardLayout` now routes both tall form factors to the tabbed layout, which sizes its gutters, chrome and hand from the form factor.
- **Two players could sit down as the same hero, and the engine let them.** A genuine rules break, caught in play: both Captain Marvel starter decks name the same identity card, so a table could hold two copies of a unique card. The rule is RRG "Unique" — one copy by title *across all players* — with the carve-out in the same entry that *"if two identities share the same title, but each has a different alter-ego, they may coexist in play"*. So the predicate is title **and** alter-ego, not card id: the coarse version gives the right answer for Core but would wrongly reject a Peter Parker Spider-Man beside a Miles Morales one in Phase 7, and both the engine and the client have a test using a synthetic same-title/different-alter-ego pair to prove the carve-out is implemented rather than accidental. `createGame` now refuses the setup with a new `duplicate_unique_card` code (distinct from `invalid_setup`, which means a malformed config — this is a legal-but-conflicting player choice a client will want to route to "pick another hero"). The Title screen no longer *offers* it: a hero already at the table dims in place, the tap is refused, and holding the card still opens it with the reason where the choice button would be. Enforcement at setup is complete for the current pool — an identity cannot enter play by any other route.
- **A decision names the seat it belongs to.** With more than one hero at the table, "Mulligan" does not say *whose* — and in a two-Captain-Marvel game even the hero's name does not, because the aspect is the only thing that tells the seats apart. The choice sheet's title bar now carries the deciding identity's current face name, its subtitle (form and aspect) and its card, so the seat is recognisable at a glance rather than only readable. Shown only in multiplayer, where the ambiguity exists.
- **Card backs, and an information leak closed with them.** `artFor(card, {kind:"back"})` read `images.back ?? images.front` — and almost no card has a back, so a **facedown card was drawing its own face**. Three backs now exist as assets (player, encounter, villain) and a hidden card resolves to one of them *before the card is consulted at all*, so there is no fallback left to leak through. Which back is decided by ownership, never by the card's type: `ownerId` says which deck it came from, and that is not the secret — reading the card's type here would be reading the very thing it is facedown to hide. The encounter deck draws its back too, since a deck is a facedown stack.
  - There is nothing per-card to repopulate: MarvelCDB carries a `backimagesrc` for **6 of 205** Core records, all of them main-scheme A/B pairs already handled, because in the physical game the back belongs to the deck rather than to the card.
- **Fixed: payment opened already paid.** `beginPayment` started from `query.suggested`, the engine's smallest working payment, so tapping a card put the bar straight to "PAYING 2 / 2" with a resource you never chose already marked spent — and, because the card being paid *for* wore the same red ring as the cards being spent, it read as "both of these are going away". Payment now opens empty and the count fills as you pick, the way the design canvas shows it; the subject keeps the red ring and a "paying for" tag, and a spent card gets an ink "spent" tag and a light wash instead.
- **A tap on a hand card opens it first on phone and tablet.** At those widths the hand is a row of thumbnails a centimetre wide — too small to read, and much too small to commit a turn on — so the tap opens the card and the sheet offers to play it. At desk widths the card is already legible, so a tap still plays and a hold still opens the sheet.
- **Fixed: the Inspect sheet could not be dismissed on a phone.** Both panels swallowed taps so that only the scrim would close it, and on a phone the scrim is a few pixels of margin. The card panel carries no controls, so it now dismisses like the scrim; the "Esc" chip became a real Close button, because a phone has no Esc key; and the hint says what actually works rather than "tap anywhere".
- **A card choice is two rows, not one stack.** Six options in one row have to overlap, and an overlapped card shows a sliver of its left edge — enough to tell them apart, nowhere near enough to read one. Picking a card now lifts it out of the stack into its own row above, where the picks are short enough to sit un-overlapped; the newest pick is drawn last and is therefore the fully readable one, and the stack below spreads out as it empties. Deselecting puts the card back.
- **Content bug found on the way: every main scheme's two sides were swapped.** MarvelCDB's front/back for a main scheme is "the side you play with" / "the side you set up from", not A / B — the aggregate record's image (`01097.png`) is stamped **97B** and prints the threat and acceleration, while the linked record's (`01097b.png`) is stamped 97A and carries the Contents/Setup text. The ingest read it the intuitive way, so the table drew each scenario's *setup* side next to B-side threat numbers. Fixed in `scripts/marvelcdb/normalize.ts` and regenerated; the mapping is asserted for every scenario in `core.test.ts`, with the collector numbers recorded in the comment because the correct mapping looks like a typo and would otherwise get "fixed" back.
- **A panel that is already card-shaped now *is* the card.** A minion in a row or an ally in the play area has a slot the same shape as a scan, so the scan fills it and only what the *game* knows rides on top: the statuses, and an ink strip carrying the numbers that change. Wider panels (identity, villain) keep a card column down the left, now sized to the panel's full height rather than to a fraction of its width — the hero card was a thumbnail floating in empty ground. Their name and subtitle wrap instead of shrinking, because "Alter-ego · Justi…" loses the aspect, and the stat values shrink to their own boxes instead of running past them.
- **Hold or right-click a Title screen picker to blow it up too**, with "Play this villain" / "Take this seat" / "Remove this seat" and Cancel. This needed the Inspect sheet to work with no game behind it, since nothing has been dealt yet at that point: `cardInspectModel(card, face)` is the content-only half — name, type, full current wording, the printed wording when errata changed it, flavour, keywords and traits *for that face*, resource pips, set and collector number. Live stats are deliberately left empty rather than invented: the scan prints them, and a client that made up a number for a card not in play would be stating a rule.
- **No button label runs past its own control any more.** `McButton` fits its text the way `McCardTile` fits its caption — a button reading "REMOVE THIS SEA" is worse than one that says it a point smaller.
- **Hold or right-click an option to blow it up.** On a phone every option is a thumbnail, so the Inspect sheet now opens from a decision too, showing the card full size with **Select / Deselect** and **Cancel** instead of "Play it". The sheet reports the answer back rather than deciding: it emits the option id and the choice overlay toggles it, the same way "Play it" already hands the play back to the Board. Its "Right now" callout is suppressed in this mode — "a decision is open, answer it first" is unhelpful when answering it is exactly what the button below does.
- **Fixed: Inspect vanished when you released the right mouse button.** It opens on pointer*down*, so the matching pointer*up* landed on a scrim that did not exist when the gesture began, and dismissed it. The sheet now dismisses on a fresh press, not on the release of the press that opened it.

### What landed (2026-09-12, later that day)

Three pieces, built in parallel and integrated here: the two items PLAN.md named as blocking the Phase 4 exit criteria, plus the rules break it flagged as reachable in the first game anyone plays. Everything below is verified in the browser against a real Rhino solo game, not only in tests.

**The villain-phase walkthrough screen** (`scenes/villain-phase.ts`, `view/villain-phase-reveal.ts`). The view model had landed already; this is the screen. It runs in parallel over Board, narrates the five RRG steps as they land, and closes itself when the phase ends.

- **It is paced by a reveal cursor, not by the engine.** The engine can hand over an entire five-step phase in one command, so `revealOf(walkthrough, revealed)` answers a different question from the `Walkthrough`'s own `status`: what the *screen* has shown, rather than where the engine actually is. Without it a walkthrough would arrive already finished.
- **It never collects an answer.** Most pauses *are* an open `PendingChoice`, and the pending-choice overlay owns those. When one is open the walkthrough shows the pause's label and calls `bringToTop` on the choice sheet, so the thing the player must act on is never behind the thing that is only narrating.
- **Skip, Esc and Continue all just stop the scene**, and the Board's launch condition fires only on step one, so a phase the player skipped stays skipped for the rest of that phase.
- **The Board contract is one guarded call**, documented at the top of both files. `scene.launch` is **not** a no-op on an already-running scene in Phaser 4.2.1 — it queues `SceneManager.start`, which for a scene in RUNNING..SLEEPING calls `sys.shutdown()` then `sys.start()`, a restart that would throw away the accumulated beats and the reveal cursor mid-phase. `run()` is no safer; a RUNNING scene falls through to the same `start()`. Hence the `isActive` guard, which is load-bearing and commented as such.
- **Fixed while integrating: the screen labelled round 1's villain phase "Round 2".** The engine hands over the phase *and* `roundStarted(2)` in one command, so following the last round seen — or reading `state.round`, which has already moved on for the same reason — names the wrong round. The round is now frozen when the phase opens, derived from the round the command began in. Caught in the browser, not by a unit test, so the regression test asserts against a real game.
- **Fixed while integrating: reduced motion gave the player the least time to read.** With no reveal timer the whole phase lands at once, so the screen was instantly "caught up" and the auto-close fired a second later — the opposite of the scene's own stated contract ("the player reads at their own pace rather than a timer's"). Reduced motion now never auto-closes; Continue, Skip and Esc are the ways out. The normal-motion tail went from 1100ms to 2600ms, which was shorter than two beats at the 550ms reveal interval.

**Abilities on cards in play** (`view/ability-label.ts`, `view/highlights.ts`, `scenes/board.ts`, `scenes/inspect.ts`, `view/focus.ts`). `legalActions` listed them and `paymentFor` priced them; now the board triggers them.

- **A card with a usable ability wears a green `▶` line**, and a tap runs the same machinery as everything else: target-select when the engine offers more than one target, the payment mode when it costs something, otherwise straight to `dispatch`. No legality, cost or target is decided client-side.
- **One ability is a tap; two or more open Inspect as the picker**, because the sheet already shows the full rules text so the player can read what each does before committing — and it already has the "report the decision, never dispatch" pattern that `mc-play-card` established. **Unexercised by Core content:** no Core card ever offers two simultaneous `useAbility` entries on one instance, so that branch is covered by test data only. Same for the `useAbility` retarget path.
- **Ability names are never invented.** `AbilityReference.label` first, else the cost spelled out from the engine's own `AbilityCost` ("exhaust, remove 1 snoop counter"). No Core action ability that reaches `useAbility` carries a printed label, so every real case takes the cost phrase.
- **Fixed while integrating: the on-card line showed the card's name twice and its cost not at all.** It read `▶ Surveillance Te…` on a play-area panel — the name is already printed on the card underneath. The on-card line now carries the cost alone (`abilityShortLabelOf`); the name-prefixed form stays in Inspect, where a list of buttons needs it. The draw sites also moved from `setWordWrapWidth(...).setMaxLines(1)`, which drops every word past the first line without a trace, to `fitText`, which shrinks to the design's floor and then ellipsizes — a clipped label should at least admit it is clipped.
- **Fixed on the way:** Inspect's `statusOf` marked a card `playable` for a `useAbility` match as well as a `playCard` one, so an ability-bearing card rendered a "Play it" button that silently did nothing.

**The unique-card rule** (`engine/src/unique.ts`, `actions.ts`, `resolve/apply-effect.ts`, `setup.ts`, `events.ts`). PLAN.md had this as an open ruling; it is now a cited one.

- **RRG 1.8, "Unique Icon" (pp. 45–46), read from FFG's own PDF, settles the half PLAN.md could not:** *"A non-villain card in an out-of-play state that matches a card in play cannot enter play."* A player card "cannot be played or put into play. Any effect that attempts to do so has no effect"; a non-villain encounter card "is discarded" with its entering-play and reveal effects ignored. So the Make the Call path needed no guess.
- **RRG 1.8 overhauled uniqueness, which PLAN.md did not anticipate.** The "one copy by title, with carve-outs for identities and allies" wording quoted above is 1.5–1.7 text. 1.8 replaced it with a single symmetric *match* predicate over title/subtitle/alter-ego title, and the ally carve-outs fall out of it rather than existing separately. It gives the same answer as the existing identity work for every case that work was built for. **It is not transitive**, so it can never be a string key — `setup.ts` now scans seats pairwise, with a test pinning the non-transitivity so nobody re-keys it.
- **`legalActions` surfaces it** as `duplicate_unique_card`, the same code as the setup refusal, because it is one rule at three entry points. The `no_valid_target` max-copies rule (`maxPerPlayer`/`maxPerHost`) is untouched and still per-controller.
- **The client stopped carrying its own copy of the rule.** `view/seats.ts` had the predicate transcribed from the superseded 1.5–1.7 wording; it now asks the engine's `cardsMatch`. It happened to agree for every Core deck and would have diverged the moment a subtitle did the work — two implementations of one rule only stay in step by luck, and "rules stay out of the client" is the standing architecture rule.
- **A refused entry is logged** (`uniqueEntryBlocked` → a game-log line), for the same reason `threatRemovalBlocked` is: the board shows no change, so without it the card simply fails to arrive and reads as a bug.
- **Unconfirmed reading, flagged in code:** the RRG settles the *resolution* but not whether the attempt is legal to make. Read literally a player could pay Make the Call's cost and get nothing; the engine instead refuses the cost pick, citing RRG "Target" ("can only be initiated if it has at least one valid target"). **Open question for FFG:** can a player legally pay for an effect that would put a matching unique card into play, burning the cost for no effect?
- **Scoped deviation: the reveal branch is not implemented.** RRG 1.8 also says a matching encounter card *being revealed* has its reveal effects ignored and the revealing player is dealt a facedown card instead. Unreachable in the current pool — every unique Core encounter card has `quantityInSet: 1` and none shares a title with a Core identity or villain — and it becomes reachable with a set carrying duplicate unique encounter cards or a hero as an encounter card (Civil War). Add it with that set.

**Also fixed:** a choice option drew its card with `fit: "cover"`, whose contract is "only for a slot that is already the card's own shape". The option slot is portrait but an option can be any card, and a **scheme is landscape** — so choosing a target for an ability showed the main scheme cropped down to a detail of its own artwork, name and threat box outside the frame. It uses `contain` now; for the portrait cards the slot usually holds, the two fits are identical.

**Verification note.** The in-app browser pane throttles `requestAnimationFrame` to roughly one frame per second, and Phaser paces timers per frame, so the walkthrough reveals about one beat per second there instead of the designed 550ms. That is the harness, not the game. Also worth knowing for future console-driven debugging: `import('/src/session.js')` and `import('/src/session.ts')` are **different module instances** under Vite, with different stores — driving the first one leaves the UI showing the second.

### What landed (2026-09-12, rexUI)

Two of the three rexUI gaps closed: the Inspect scroll panel and `McTextInput`. Scenes still never call rexUI directly, only through `ui/widgets.ts` (`McScrollPanel`, `McTextInput`) via `ui/rex.ts`, which is the single file that imports the toolkit. **Verified in the browser by the integrating session**, which found two bugs that typechecking and tests could not (below).

- **The Inspect scroll panel** (`scenes/inspect.ts`) is rexUI's `TextArea`, which earns its place: it virtualizes lines (only the visible ones are live `Text` objects) and owns wheel/drag scrolling, which is real work to hand-roll. The rules text, the errata "printed text" callout and the flavor line now share one scroll region sized to whatever room is left under the art, instead of three stacked `Text` objects that could each run past the card's own footer — which is what a long villain-stage or scheme text actually did before this. **Cost paid:** the merge drops the errata line's red ink and the flavor's dimmer tone to a single uniform style. Recovering that with `BBCodeText` was rejected: Core card text prints literal `[energy]`/`[mental]`-style bracket tokens (confirmed against `packages/content`'s own text-token allowlist), which `BBCodeText` would parse as markup.
- **`McTextInput`** (`ui/widgets.ts`) is rexUI's `InputText` — the app's one DOM element, styled off the `secondary` skin (ink border and text on paper) rather than left at rexUI's defaults, with focus shown by reusing `McSelectionRing` rather than a second focus treatment. It closes a real gap: **the Title screen had no way to type a specific seed**, only "roll one and look at it" — undermining the one thing a seed is for (PLAN.md Phase 1's `GameLog`/`replay()`). The seed field is numeric-filtered per keystroke and re-validated by a pure `parseSeed` (`view/seed.ts`, tested) before `Start game` will use it; "New seed" still rerolls it. **The DOM input survives `TitleScene#rebuild()`** (detached from the display list before its `removeAll(true)` sweep and handed back after) rather than being destroyed and recreated on every resize/art-arrival redraw, which would otherwise blur it and drop the cursor mid-keystroke on every scan that loads.
- **Cost found, then mostly removed.** Registering `RexUIPlugin` added roughly **1.1 MB** to the minified main chunk (1.6 → 2.7 MB) for two components, because `ui-plugin.js` registers an `ObjectFactory` for rexUI's entire component library regardless of which factories are called. That is avoidable: each component ships its own module, and the factory the plugin registers is exactly `new Component(scene, config)` followed by `scene.add.existing(…)` (see `templates/ui/textarea/Factory.js`), so `ui/rex.ts` constructs `TextArea` and `InputText` directly and no plugin is registered at all. **2.07 MB, gzip 523 kB** — 633 kB saved raw, 155 kB gzipped, same calls. rexUI's real cost for these two widgets is ~466 kB, which line-virtualized scrolling justifies; 1.1 MB of unused dialogs, charts and spinners did not, least of all for a client Phase 8 packages to mobile.
- **Fixed in the browser: the seed field rendered off the left edge of the screen.** `origin: 0` is read from config by rexUI's sizer-based widgets, but `InputText` extends Phaser's `DOMElement`, which positions by its *centre* and ignores that key — so the field was centred on its rect's top-left corner and hung off-screen. It sets its origin on the object now. A screenshot found this in seconds; nothing else could have.
- **Fixed in the browser: Inspect's rules text was cropped to a fragment.** It read "If this stage is completed, the player" and stopped. rexUI computes the wrap width correctly; the fault was that for a plain Phaser `Text` it defaults to clipping with `setCrop`, and that crop came out far narrower than the wrapped text it was clipping. `textCrop: false` selects the geometry-mask path, which clips to the block it actually measured. **Note for a future reader:** the obvious diagnosis — "rexUI isn't wrapping, set a wordWrapWidth" — is wrong, and setting one changes nothing, because `TextBlock.resizeText` overwrites `style.wordWrapWidth` on every layout.
- **Verified end to end:** typing seed `43523` on the Title screen reproduces that game's opening hand card for card (Interrogation Room, Surveillance Team, Energy, Heroic Intuition, Spider-Tracer, Web-Shooter), which is the deterministic-replay guarantee finally reachable from the UI.
- **Left for the same follow-up PLAN.md already named:** the virtualized game-log grid table (rexUI's `GridTable`) is `scenes/board.ts`'s to do, since that file is owned elsewhere; the other candidate spot, `McTabs`, stays native — it was already cheap by hand and switching it would cost the bundle more rexUI surface for no clarity gain.

### What landed (2026-09-12, the board pass)

The last three board items, alongside the rexUI work above. Everything visual was checked in a browser by the integrating session — none of the agents that wrote this code had a browser tool, and the two rexUI bugs recorded above are the argument for why that pass is not optional.

- **Card-movement tweens** (`view/travel.ts`). `travelsFrom(events, anchorBefore, anchorAfter)` turns `cardMoved` events into travels given two anchor lookups; the Board supplies them from `#hitRects` snapshotted either side of a redraw. **The tear-down-and-redraw model was kept deliberately** rather than rebuilt into a persistent-object reconciler: `beats.ts` already proved the cheaper shape, which is to hold the animation as *data with a start time*, so a redraw mid-flight recreates it already partway along instead of losing or restarting it. A travel between two zones the board never shows the inside of is refused even when both ends resolve to a rect.
- **Gamepad navigation** (`view/gamepad.ts`). `gamepadIntentFor(buttonIndex)` maps the standard layout to the same five intents the keyboard produces, and `#bindKeys` was refactored so both inputs converge on one `#actOnIntent` — "keyboard and gamepad drive one route" is now structural rather than coincidental. D-pad and face buttons only; no analog polling, since every intent is reachable without a stick.
- **The phone hand** (`view/layout.ts`). `cardRow(..., { fan })` keeps as many full-size cards as fit and collapses the rest to narrow "spine" slots, with wheel and drag scrolling and a "Fan out"/"Collapse" pill. Drag uses an 8px threshold so scrolling the hand doesn't play a card. The long table is untouched.

### What landed (2026-09-12, the first play-session pass)

Feedback from a real session, and a crash. Everything here was verified in a browser by the integrating session.

**The 3.5 GB heap and the crash behind a popup — two causes, both fixed.**

- **Every scene leaked itself, once per open.** Four of five scenes registered `this.scale.on("resize", …)` and never removed it. `this.scale` is the *game's* emitter, so it outlives every scene: the choice overlay opens and closes on every decision, Inspect on every card looked at, and each open left a listener whose closure retained a dead scene — and through it the game state, the view models and the card-art textures. It was also the crash: `windowResize → refresh → emit` eventually reached a torn-down scene, which is the reported `Cannot read properties of undefined (reading 'setBackgroundColor')`. All five scenes now remove the listener on `SHUTDOWN`; verified as 11 resize listeners before and 11 after 15 open/close cycles.
- **The card-art texture cache never evicted anything.** One cache per `Phaser.Game`, created once and never recreated in a tab the app never reloads, loading scans that decode to ~2.9 MB each and up to ~9 MB for a villain stage. A long game touches far more unique cards than a table's worth — every side scheme, every discard browsed, every encounter card ever drawn — and nothing was ever released. Now a 256 MB resident budget with LRU eviction keyed on request recency, card backs pinned, evicted keys reloadable transparently. Tested to stay at budget across 500 distinct cards, a scenario that was ~1.4 GB unbounded.
- **The lesson worth keeping:** an emitter that outlives a scene retains the whole scene. Anything registered on `this.scale`, `this.game.events`, `this.input` or `this.time` needs a matching removal on `SHUTDOWN`, and a listener count across repeated open/close cycles is the cheap way to prove it.

**Exhausted cards were easy to miss, and now aren't.** Reported: "I didn't even see that it was exhausted after I attacked."

- **A card in the play area turns a quarter turn**, the sign the physical game already uses (RRG "Exhaust"). It was a word in the corner at label size, sitting over the card's own cost and name. Rotation reads from across the board and is a *shape* cue, so it satisfies the colourblind rule without a second treatment. The slot's border stays square — the card turns inside its place, so nothing reflows and the targeting frame stays where the pointer expects it. The whole face is re-parented into one container, which is also what makes it a single `rotation` to tween when the animation pass lands.
- **A hero gets a filled badge instead**, because an identity sits in a wide panel with its numbers beside the card, and turning it would turn the numbers too.

**Upgrades on a hero are reachable.** Reported: "Spider-Man has Web-Shooters that should be shown somehow… I thought they would be on the popup when I right clicked on the hero." They were name-only labels. A chip is still the right shape — an upgrade lives *on* its host — so the chip now shows the green `▶` when its ability is usable, and is a tap target that opens the card. **Fixed on the way:** the host panel's own tap target is added last and sits higher in the display list, so chip taps were being swallowed by the panel behind them; the chips are now registered after it.

**Side schemes have a meter.** Asked: "Sub schemes don't have progress bars like the main scheme. Is this by design?" Half by design — a side scheme has no *threshold*, so `target` stays null, which is a rules statement worth keeping. But "no threshold" is not "no progress": the meter is now drawn against `meterMax`, the threat the scheme entered play with, so it empties as the players thwart it. Never below the threat now on it, so an effect adding threat cannot overflow the box.

**A 0-cost card no longer asks you to pay for it.** Reported against Great Responsibility. Two parallel paths in `resolve/window.ts` disagreed: `triggerCandidate` (an in-play ability) short-circuits when the cost is 0, while `requestWindowPayment` (an event played from hand inside a window) always opened the sheet — so the same free ability was silent from one route and prompted from the other. It short-circuits now. **Safe because the opt-in already happened:** the queue is filled only from what the player picked in `chooseTriggers`, which allows selecting nothing, so declining still lives where it belongs. An "X" cost is deliberately excluded — `windowEventCost` totals only the fixed requirement, so X reads as 0 while the player still has a real decision about how much to spend.

**Decision sheets show the cards.** A "Trigger an ability?" prompt was a bare name row ("1. She-Hulk"). The cause was that `chooseTriggers` options carry `ref.kind === "ability"`, not `"card"`, so they missed the existing card-rendering path even though they name a card by `instanceId`. They now render as the card, with a caption strip naming the specific ability (a card can offer two at once, and two identical slots would be indistinguishable).

**Inspect no longer opens behind the decision sheet.** Phaser's `bringToTop` splices a scene to the tail of the Scene Manager's array — a *standing* position, not a per-frame z-index. So the first villain-phase decision of any game left the choice overlay permanently above Inspect's registration-order position for the rest of the session. Inspect now re-claims the top on every rebuild.

**The villain walkthrough says more.** Reported as "pretty awesome… there should be an option to see the actions appear in sequence so I can know what the result of my defense is."
- **"Deal encounter cards" was silently empty every phase** — the engine emits only `cardMoved` for it, which the log drops as bookkeeping. It now reads "You are dealt a facedown encounter card", deliberately without naming the card, since step 4 usually resolves in the same command and naming it here would spoil the reveal one step early.
- **The defence outcome already had the right wording** and now has a test: "Rhino hit Spider-Man for 1 (ATK 2 + 2 boost − 3 defense)". Found while testing: a fully-defended hit emits no `damageDealt` at all, so that beat is the *only* place the outcome ever appears.
- **A pause now says what is on offer** ("Rhino → Spider-Man. Options: …"), built from the engine's own `PendingChoice.options`. The pending-choice sheet still owns collecting the answer.

### What landed (2026-09-12, stat badges)

Reported from play: the hero stat boxes were "very small and hard to read", HP was "tiny", and a buffed stat showed no sign of its buff. The stats were four boxed tiles crammed into the ~110px text column beside the card, where "THW ATK DEF" collapsed into overlapping "TH|AT|DE" and HP was the smallest number on the panel. The suggestion that shaped the fix: draw the card's own stat icon as a reusable component. Verified in a browser on a hero, the villain and an engaged minion.

- **`McStatBadge` draws each stat the way the printed card does:** a coloured starburst holding the number, the stat's name on an ink ribbon beneath. Players already read those shapes as those stats, so the live number goes into the same shape rather than a new one. It is one container, so a card that turns sideways when exhausted turns its badges with it, and `update()` changes the number in place for a future animation pass. It registers nothing on an emitter that outlives the scene.
- **`McHpPlate` makes HP the most prominent number:** the current value large, the maximum smaller beside it, and a meter along the foot so "how hurt" reads before the digits do.
- **A buff is a signed chip ("+1"), never only a colour.** Heroic Intuition's +1 THW shows on Spider-Man's THW badge, and Inspect writes it as "THW 2 (+1)".
- **Placement: a row beside the card on a wide panel, over the printed icons on a card-shaped one.** An identity's or villain's scan is shown whole so its rules text can be read, so its badges sit in a row in the text column with the HP plate beneath. A version that stacked hero badges over the card's printed icons made them larger but covered the card's own text ("Spider-Sense — Interrupt…"), and was rejected in play. A card-shaped panel (an ally, a minion) has no text column, so its badges go over its printed icons, where an opaque badge replaces the stale printed number with the live one.
- **Crowded play areas were measured, not assumed** (`cardRow` + `cardStatColumn`, 1–12 cards at 360, 500 and 700px). A neighbour never covers a card's badges: they sit at the card's left edge, and `cardRow` shrinks cards to 35% before it overlaps them. What does change is proportion. Badges reach their 12px floor at 6 cards on a phone row, 8 at 500px and 12 on the long table; until then they stay ~30% of the card's width. The HP plate's 14px floor is the one piece that grows relatively, to ~25% of card height on a very crowded phone row. Revisit if that reads as covering too much.
- **Colours:** THW blue, ATK red and DEF green are taken from the card's icons; SCH and REC are chosen, not taken from a card. None reuses the three status hues the design reserves as existing nowhere else.

**Found on the way: a stat-buff implementation was already in the tree, uncommitted.** `StatTile.bonus` was computed as *modified − printed* by an exported `profileStatTiles`, deliberately so a "has a base ATK of N" override counts too. It was kept rather than replaced, and Inspect — which still had its own older copy of the stat rules — now calls it, as its doc intended. That design also had a real bug, confirmed from the scripts: Ultron's facedown Drones take their whole stat line from base overrides (ATK 1, SCH 1, HP 1) while `printedProfile` reports a facedown minion as all zeros, so every Drone would have shown false "+1" buffs. `printedStatsOf` now gives a facedown card no printed profile to subtract from, which keeps `bonus` true to its own promise: the table differs from *the card*, and a facedown card has no face. A real Ultron game is the regression test, and it fails loudly if no Drone ever appears.

**Not verified:** an exhausted card-shaped panel *with* badges on screen. They turn by construction — they are drawn inside the range `#turnSideways` re-parents — but no Core ally was affordable in the scripted game used to check. The hero's HP plate is still modest at narrow window widths, where its text column is under 100px.

### What landed (2026-09-12, saved games and game over)

A refresh used to lose the game, and the game-over screen was a placeholder ("DEFEAT", a reason, a round count) nowhere near the designs. The two are one piece of work, because the screen the canvases draw needs a story about the whole game, and a story that survives a refresh has to be derived from something that survives it.

**Games are saved as they're played, to IndexedDB, and resumed by replay** (`engine/game-storage.ts`, `engine/idb-game-storage.ts`, `engine/session-core.ts`).
- **What is stored is the log, not the state:** the setup config, the post-setup baseline (without the card pool, which reloads from the bundle), and each command as it lands. Phase 1 made `applyCommand` pure and `replay()` deterministic precisely so a log fully describes a game, so resuming is "replay the log" — the same game to the command, not an approximation of it.
- **Storage lives in the engine worker**, beside the log it writes: each command is saved by the thing that applied it. Three object stores — a small `games` summary row per game (what "Continue" and listing read), a `baselines` store read only on load, and `commands` keyed `[gameId, seq]` so a log is a key range and each append is one small put.
- **Every append is checked for order.** It carries its sequence number and is rejected unless it's the next command, so a lost or reordered write fails when it happens instead of producing a log that replays differently later. After a failed write the session stops saving and surfaces `saveError` (the game plays on; nothing about the rules depends on the disk).
- **A save that no longer replays is retired, not resumed.** If any stored command is rejected by this build's engine — a card changed under an old save — the game is marked `incompatible`, never offered again, and kept rather than deleted.
- One game in progress at a time: starting a new game marks the previous active one `abandoned`. A finished game is recorded `won`/`lost` and is not offered as "Continue".
- **The Title screen offers "Continue — Rhino · Spider-Man (Justice) · round 1"** when a game is in progress. Verified in the browser against real IndexedDB: play three commands, reload the page, click Continue, and the Board picks up at the same command and round.
- `MemoryGameStorage` (Vitest, and `LocalEngineHost`'s default) and `IdbGameStorage` run **one shared contract test**, with `fake-indexeddb` standing in for the browser; memory storage copies in and out with `structuredClone` exactly as IndexedDB does, so a test can't pass on a shared reference the real storage would never have. A refresh is tested as a second host on the same storage.

**What the game-over screen reports is derived, never saved** (`engine/game-record.ts`). A `GameRecord` — damage and thwart per seat, per-round threat, Crisis blocks, eliminations, the last threat placed and the last hit on the villain — is folded from the engine's events by one reducer, live as each command lands and again when a saved log is replayed. Only the log is persisted, so the record can't drift from it, and a resumed game ends with exactly the summary it would have had uninterrupted. Attribution is "the seat that controls, or else owns, the card the engine named as the source"; a threat placement learns who it was scheming against from the enemy activation in progress.

**Game over now follows the canvases** (`scenes/game-over.ts`, `view/game-over-model.ts`).
- **Wide** (Screens - Desktop #12): the outcome's colour as the whole ground — Hero Red for a loss, green for a win — the headline ("The scheme wins"), a final-blow box ("The Break-In! hit 7 threat / Placed by Rhino scheming against Spider-Man"), three stat cards, "Where it went wrong" (or "How it was won") as round-tagged turning points, the table's seats, and the rematch actions.
- **Tall** (Phone P11 / P17): ink ground, the villain's card whole in a band up top, kicker, headline, one summary sentence, three number boxes, actions at the thumb.
- **Every sentence traces to a count in the record**; where the record doesn't know something the sentence says less rather than guessing. Turning points are only Crisis blocks, eliminations, stage advances and the single heaviest threat round.
- **"Run it back"** keeps the scenario and seats with a fresh seed; **"Same seed, same hands"** replays the identical deal. Both reuse the session config, which the host now publishes with every update so a resumed game can rematch too. Verified in the browser: Run it back deals a new Rhino game at the mulligan with a new seed and a reset record.

**Fixed on the way.**
- **The Board left its overlays running behind Game Over.** It hands off as soon as `outcome` is set, before `#syncChoiceOverlay` gets its turn, so the choice sheet kept running — invisibly, holding its store subscription — under the game-over screen. The Board now stops the overlays it launched when it shuts down, and resets `#choiceOpen` so the next Board relaunches the sheet. Verified: at Game Over only `GameOver` is running.
- **`EngineSessionCore.start` became async** (creating the save is awaited, because a game not yet recorded has nothing for its first command to append to), which broke the storage contract test's synchronous baseline — the build error reported after the board refactor merged.

### What landed (2026-09-13)

Three of the open items, worked in a git worktree and verified in a browser against real Rhino solo games, at 800×600 and on the 375×812 phone board.

- **Payment reaches resources on the table** (`view/payment-model.ts`, `scenes/board/hand.ts`).
  - `PaymentView` gains `tableSources`, every `resourceAbility` source with one entry per option, and `subjectInHand`.
  - While paying, the head of the hand row carries a tile per table source, tagged "IN PLAY" with its pool ("+1M"). It turns "SPENT" when picked, and the card also rings in its own zone as before.
  - A tile toggles by **option id, not by card**, so a card with two resource abilities is two tiles (`BoardController.togglePaymentOption`).
  - When the card being paid for is itself in play (an ability's cost), it gets a "PAYING FOR" thumbnail there too.
  - Why the hand: it is the one zone every layout shows. On the phone board Peter Parker's Scientist lives on the Me tab, and paying for Jessica Jones from the Threat tab now shows it anyway.
  - Strip tiles are left out of `hitRects`, which says where a card *is* for beats and travels. They do register a focus rect, so the keyboard lands on the always-visible tile.
  - Tested against a real game: in alter-ego, Scientist is offered as a table source, and a payment spending it is accepted by `applyCommand`.
  - **Correction to the note this replaces:** Web-Shooter is not a resource ability. In Core the two are Peter Parker's Scientist and Pepper Potts.
- **A failed save is said, and keeps being said** (`scenes/board.ts`, `scenes/board/chrome.ts`).
  - The first time `saveError` is set, the table announces "Game not saving — it may not survive a refresh".
  - The chrome bar then carries a caution "⚠ NOT SAVING" chip for the rest of the session, displacing the 1st-player mark.
  - **Not verified in the browser:** there is no way to make IndexedDB fail on demand from the pane. It is typechecked and uses the same banner path as "X is down".
- **Keyboard and gamepad on the overlays** (`view/choice-focus.ts`, `scenes/choice.ts`, `scenes/inspect.ts`). The Board already handed input over while a sheet was open; now something picks it up.
  - **The choice sheet** has a stated, tested route: the options as drawn (picked row first, then the stack), Confirm, then Decline when declining is legal. It uses the Board's static ring, and focus follows a card as it moves between rows. Enter/Space press, `I` reads a card option, and Escape drops focus rather than dismissing, because a decision has to be answered.
  - **Inspect** speaks the same five intents instead of three raw key bindings: ◂ ▸ step, Enter presses its primary button (Select, the first ability, or Play it), Escape closes.
  - `stepFocus` is generic now, so both routes share it.
  - Verified: Tab to a mulligan card, Enter lifts it into the picked row with the ring following, Tab to Decline, Enter resolves. On the board, `I` opens Inspect, → steps, Enter on Nick Fury opens his payment, Escape backs out.

**Verification notes for a session working in a worktree.**
- **The Browser pane's `preview_start {name}` reads `.claude/launch.json` from the main checkout,** not the worktree, and a worktree-isolated session cannot edit main's copy. What worked: run the worktree's Vite from Bash on its own port (`pnpm --filter @mc/client exec vite --port 5183 --strictPort`) and open it with `preview_start {url}`. A different port is a different origin, so its IndexedDB saves don't mix with another session's.
- **The pane's `Return` key sends a keydown with an empty `key`;** use `Enter`.
- **Mobile emulation throttles timers hard.** At 375×812 in the pane, Boot's 3 s font timeout took over 20 s to hand off to Title. A phone-sized Title was seen without "Continue" while a save was active, yet the same page shows it at desk size, `latestSave()` returns the save, and nothing phone-specific in `TitleScene` gates it. It is recorded as unreproduced outside the throttled pane, not as a bug. Worth one look on a real phone.

### What landed (2026-09-13, the rest of the open list)

The five items the previous pass left open, plus three bugs found while closing them. Checked in a browser at 800×600 (long table) and 390×844 (phone board and tall Game Over) against real Rhino games. What was *not* seen is said item by item.

**The game log scrolls** (`view/log-view.ts`, `scenes/board/log.ts`).
- **Built by hand, not with rexUI's `GridTable`.**
  - The Board clears its display list and redraws on every change. A persistent GridTable would have had to dodge that sweep, the way the Title's DOM seed field does, and still have its offset restored on every resize.
  - Instead the scroll position lives in a plain `LogScroll`, the same shape as `HandScroll`. Each draw builds `Text` objects for the visible lines only, which is the virtualization this plan asked for.
  - It adds nothing to the bundle.
- **Anchored to a line id, not an index.** The log trims its oldest lines at 400, and an index would silently shift the view. Scrolling snaps to whole lines, so no clipping mask is needed.
- **Follows the newest line until the player scrolls back.** After that, new lines arrive below without moving the view, and a "▼ N newer · latest" chip jumps back. Wheel over the panel scrolls it; so does a drag, for a phone.
- **Lines wrap** instead of stopping at one. Heights are measured once per line per width. At the long table's ~130px column the one-line version cut "Rhino hit Spider-Man for 1 (ATK 2 + 2 boost − 3 defense)" down to its first words.
- **Status tags are drawn** as chips in their status hue, named in words and struck through once spent. The old panel dropped them, so "Klaw is" ended there.
- **A rule down each line's left edge** shows the voice (villain red, scenario caution, win green) for scanning. The words still carry the meaning.
- **Fixed: a rematch kept the last game's log.** Phaser reuses the Board instance, and `#log` was set only when the class was constructed. So "Run it back" dealt a new game under "The villain is defeated. You win."
  - The Board now resets its log, scroll, tab badges and focus in `create`.
  - A resumed game's first lines take their round from the state instead of reading `R0`.
- **Seen:** wheel scroll anchoring the view with the newer chip; wrapped lines on the long table; the phone Log tab.
- **Not seen:** drag scrolling (there is no touch in the pane).

**Your deck and discard are piles on the table** (`view/hand-row.ts`, `scenes/board/piles.ts`).
- **They sit beside the hand**, because the hand is the one zone every layout shows, on every phone tab.
  - On the long table they flank the hand at card size.
  - On the tabbed board they stack in one narrow column at the left, and a scrolled hand slides under them.
- **The deck** shows the player card back and its count.
- **The discard** shows its top card faceup. A tap opens that card, with ◂ ▸ through the rest of the pile.
- **Card movement.** Each pile registers in the frame's `pileRects`, and `motion.ts#pileAnchor` now resolves deck and discard moves to those boxes. The encounter deck and discard register their own boxes too, instead of the whole encounter column. The hand caption no longer says "deck 28 · discard 3", since the piles show those counts.
- **Fixed: the encounter discard showed its oldest card.** The engine puts a discard on top by prepending (`moveCard(..., "top")`), but `topOfDiscard` read the last element.
  - Worth a look by `game-rules-architect`: one engine path (`resolve/apply-effect.ts`, around line 97) discards to the encounter discard's *bottom* by default.
- **Seen:** both layouts, and Emergency landing on the discard pile after it was played.
- **Not seen:** a travel mid-flight (the pane runs at about one frame per second), or the discard tap opening Inspect.

**No gap between the payment strip and the hand.** `handRow` lays out piles, strip and hand together, and centres strip and hand as one group. Before, the strip sat at the row's edge and the hand centred itself in whatever was left. Seen with Peter Parker's Scientist tile while paying for Interrogation Room.

**The win screen has been seen.**
- **Wide:** green ground, "Rhino defeated", "Spider-Man landed the last 2", "Stage II cleared", "How it was won".
- **Tall:** the villain band, the yellow kicker and boxes, and the "Table MVP" row.
- **No natural win was available.** The greedy driver lost all 450 solo games tried (25 seeds × 6 starter decks × 3 scenarios), and every e2e table.
- **So the fixture patches a save.** `view/game-over-win.test.ts`:
  1. saves a real Rhino game;
  2. rewrites the *saved baseline* so Rhino is on his last stage, one hit from defeat;
  3. resumes it through `LocalEngineHost`, as a refresh would;
  4. lands the hit with a real basic attack.

  Everything after the baseline is the engine's own work. The browser check applied the same patch to the pane's IndexedDB.
- **Still unseen with content:** "How it was won". The stage advance happened in the patched baseline rather than in the log, so the panel honestly listed no turning points.

**Keyboard and gamepad on every screen** (`scenes/focus-route.ts`, `view/screen-focus.ts`). A shared `FocusRoute` gives Title, the villain-phase walkthrough and Game Over the Board's five intents and its static ring, over routes stated as data.
- **Title.**
  - Order: Continue, each scenario, difficulty and hero, the seed field, New seed, Start game.
  - Enter on the seed field puts the caret in it. Enter or Escape hands the keyboard back, and the key stops there, so it doesn't also press the focused control.
  - A hero already at the table still takes focus, and `I` reads why.
- **Walkthrough.** Continue (once the phase is over), then Skip. Escape skips.
  - **Fixed:** the Board wasn't blocked while the walkthrough was up, so the arrows moved focus around the table unseen underneath it.
  - **Fixed:** Escape used to skip the walkthrough from under an open decision.
- **Game Over.** The action list's own order, then Back to title. On the wide loss screen the ring is drawn in ink, because Hero Red would vanish into the red ground (`McSelectionRing` now takes a colour).
- **Seen:** on Title, Tab, Shift+Tab and Enter start a game. The mulligan was declined by keyboard. On the walkthrough, Tab rings Skip and Escape skips. On Game Over, Tab rings Run it back and Enter deals the rematch.
- **Not seen:** a real gamepad. It goes through the same intents.

**Fixed: Title came back unusable after a game.** Title is a reused instance too, and `#starting` stayed set after a successful Start or Continue because the scene simply moves on. So Game Over's "Back to title" found Start stuck on "Starting…" and Continue disabled, with no way to begin another game. It is reset in `create` now. Verified by sending a running game back to Title and continuing it: Title is usable again, and the reused Board opens with an empty log rather than the previous visit's lines.

**Fixed, from play: searching a deck showed card backs.** Black Panther's Foresight ("Search your deck for a Black Panther upgrade… Shuffle your deck.") offered real upgrades but drew every one facedown, because `view/visibility.ts` closed deck zones without exception. In the physical game the searching player reads those cards; the shuffle afterwards is what keeps the deck's *order* secret, not the cards themselves.
- A card in a deck is now visible while the open decision offers it. Every Core choice over a deck is a genuine look: Foresight, Shuri, Iron Man's "top 3", and Klaw's search for a Masters of Evil minion. None of them is a blind pick.
- Scoped to deck zones on purpose. Being offered a card that is facedown *in play* (a facedown Drone as an attack target) does not turn it over.
- Face, name and Inspect all follow, because they share `faceVisible`.
- Tested against a real Black Panther game in `view/visibility.test.ts`: the offered upgrades show their fronts and names, and the rest of the deck stays facedown. Seen in the browser: Foresight's sheet shows Panther Claws, Energy Daggers, Vibranium Suit and Tactical Genius.
- Phase 5 note: the viewer is the player the choice is addressed to, so a server should send those faces to that player alone.

**Found, not fixed: an engaged minion is drawn twice**, in the enemies band and again in "your play area". The engine keeps an engaged minion in the player's `playArea`, and `myPlayArea` doesn't filter minions out. Filed as its own task.

**Verification notes.**
- **`.claude/launch.json` has a `client-5183` configuration.** Port 5173 (`client`) is often held by another chat's server, and the Browser pane won't share it.
- **Hover before scrolling.** In the pane, a wheel scroll only reaches Phaser after the pointer has moved there.
- **Leave a short wait between keys that change focus.** Keys sent in one batch can land in a single throttled frame. One Enter on a mulligan card was lost that way, and it was not reproduced.

Still open in Phase 4:
- **`GameSession.log.commands` grows without bound** for save/replay. That is by design and small per command, but worth a cap before a very long session. It is now also what IndexedDB stores, one row per command.
- **Game-over actions the canvases show that don't exist yet** are drawn unavailable with their reason rather than omitted ("dashed = not yet real"): the replay viewer. Not drawn at all: exporting the log, a full log reader, and "Tune deck" (Phase 9).
- **"How it was won" has not been seen with content.** See the win screen above.
- **The log column is short on the long table at 800×600**: about three lines under the encounter piles. It scrolls, but the layout gives it little room. Revisit when the long table is next laid out.
- **An engaged minion is drawn twice.** See above.

### Screen gaps against the design canvases (2026-09-13)

An inventory of every screen in `Marvel Champions game screens/` compared with the client found several missing or partial. The full list, shared prerequisites, workstreams and open decisions are in **[docs/phase4-screen-gaps.md](docs/phase4-screen-gaps.md)**. Work them from there, and tick them off in that file.

- **Missing:** Scenario select, Take your seats, Table setup (modular sets, first player, encounter deck preview), the Setup deal & mulligan screen, Pause & Rules, and a Settings screen.
- **Partial:** Title (setup is folded into it rather than a menu), deck analysis (no curve or composition in the builder, no Deck check screen), Targeting and Defend (no outcome previews or "why not"), Decks & Collection (single pane, no stats).
- **Built, with small follow-ups:** Board, Inspect, Villain phase, Game Over.
- **Engine work it needs:** outcome preview queries for targeting and defending (`game-rules-architect`), and a decision on how Concede ends a game.

### Checklist

- [x] Reference point: *Sentinels of the Multiverse* (digital edition) — a 2D tabletop-style card game, not a 3D physical simulator, playable cross-platform. Board/zones/cards are the primary UI; chrome (log, phase tracker, counters) supports it rather than replacing the tabletop feel.
- [x] Board layout: player area(s), villain area, main scheme, side schemes, encounter deck/discard, each player's identity/hand/deck/discard/play area — legible at a glance the way the physical table is. Long Table (desktop/tablet) and the phone board with its tab rail both landed.
- [x] Card rendering (using licensed-for-personal-use art per the IP boundary in CLAUDE.md), zoom/inspect, legal-move highlighting, tap-to-target interaction for choosing targets/attachments/assignments. **Landed:** real card scans through the same-origin art route with the generated frame as the designed fallback, the Inspect overlay, legal-move highlighting, tap-to-target, tap-to-play, and the payment mode for choosing what to spend. **Deliberately not built:** drag-and-drop — tap-to-target does every job the mocks use drag for, and works identically on a phone.
- [ ] Animations/feedback for damage, threat, defeat, phase transitions — enough to make state changes readable, not spectacle for its own sake. **Landed:** floating beats anchored to the card each change happened to, including the changes that leave the board looking the same (Tough, Crisis), honouring reduced motion; and the villain phase, which the engine resolves in a single command, now steps through its five RRG steps at a readable pace instead of landing all at once. **Landed since:** card-movement travel between any two zones that both have an on-table anchor. **Landed 2026-09-13:** your deck and discard are pile boxes beside the hand, so draws and discards have an on-table anchor to travel from and to.
- [ ] Accessibility pass: colorblind-safe indicators (damage/threat/keywords shouldn't rely on color alone), readable type sizes, keyboard/controller navigation if platform requires it. Scope per the stack decision above: keyboard and gamepad focus navigation, colorblind-safe indicators, minimum sizes and reduced motion. Screen readers are out of scope for the canvas client. **Landed:** icon-plus-text indicators (status pips carry their initial, stat tiles carry their label, resource pips carry their type's glyph rather than relying on a hue, the threat meter carries its numbers), the design's minimum type sizes and 44/52px touch targets, reduced motion defaulting from `prefers-reduced-motion` (honoured by the selection ring and the beats), and keyboard navigation with a visible focus ring. **Landed since:** gamepad navigation, through the same focus route as the keyboard. **Landed 2026-09-13:** the choice sheet and Inspect take keyboard and gamepad input through the same intents as the Board. **Landed 2026-09-13:** the Title screen, the villain-phase walkthrough and Game Over, through one shared focus route, so keyboard and gamepad reach every screen.
- [ ] Screens from the design canvases: the setup flow, mulligan, Pause & Rules, Settings, deck analysis, and the richer Targeting and Defend overlays. Tracked in [docs/phase4-screen-gaps.md](docs/phase4-screen-gaps.md) (workstreams W1–W9).
- [x] Exit criteria: a solo human player can play a full Core Set scenario against the AI villain from the Phase 3 engine, entirely through the UI, with no engine internals exposed. That covers one hero, or 1–4 heroes played multi-handed. **Partly met:** a Rhino solo game runs through the UI from setup, through a player turn, into and out of a villain phase (verified in the browser: mulligan, change form, basic attack, choosing what to pay and playing the card, using an ability on a card in play and picking its target, discard to hand size, villain-phase choices, the villain-phase walkthrough), with card art, Inspect and readable beats, and no engine internals exposed. **The two pieces named here as missing both landed 2026-09-12.** What remains is the sitting itself: the game has not yet been played end to end *to an outcome* in one unbroken session through the UI, which is now a matter of playing it rather than of missing machinery.

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

### Scope decided (2026-09-13)

- **Phase 7 and Phase 9 run together.** A deck builder is only as useful as the pool it builds from. And import's most common outcome, "this deck needs cards we don't have", can only name the cards precisely when every real card is known.
- **All 62 non-Core packs become card data; only wave 1 is scripted this pass.**
  - Wave 1 is what released before The Rise of Red Skull: the Green Goblin and Wrecking Crew scenario packs, and the Captain America, Ms. Marvel, Thor, Black Widow, Doctor Strange and Hulk hero packs.
  - Every other card is data the builder can show and `validateDeck` can judge, marked not playable yet.
  - The checklist item above names Rise of Red Skull as next; release order puts wave 1 first.
- **Execution:** the specialist agents work in parallel, and the main thread integrates their work and verifies it in the browser.

**Raw data fixed and refetched (2026-09-13).**
- **What was wrong.** `scripts/main.go` decoded each pack into a nine-field struct and saved that struct, not the response. So 62 of the 63 raw files held only names and image paths, with no `text`, `cost`, `health`, `traits`, `quantity`, `linked_to_code` or `boost` field anywhere.
- **The fix.** It now saves each response verbatim, in the `{ source, fetchedAt, pack, cards }` envelope that `ingest-marvelcdb.ts --offline` reads, and it takes `-images=false`.
- **Build it with `go build -o scraper main.go`**, not `go build .`: the latter also compiles `download_images.go`, a separate program in the same folder.
- **Refetched:** 63 packs, 4,126 cards. Core's 205 records came back field-for-field identical, so the committed Core data stands.

**In progress:**
- **Landed (`game-rules-architect`, verified: root typecheck clean; content 103, engine 272, cards 125, client 243 tests):**
  - **`@mc/content`:** `Deck` (with `source` and `poolVersion`) and `deckFromStarterDeck`.
  - **`@mc/engine`:** `validateDeck` from RRG 1.8 (Jul 2026) Appendix I and the glossary, returning every problem with a player-readable message, and `unscriptedCards` for "legal but not playable in this build".
    - `unscriptedCards` includes the identity's obligation and nemesis set, deliberately: setup brings those into the game.
  - **Setup:** `createGame` refuses an illegal deck with `illegal_deck`, reporting every bad seat, behind `requireLegalDecks`, which `coreScenario` turns on. Seats carry their `aspects`.
  - **Schema hooks:** `HeroIdentityCard.deckbuilding` (aspect count, the equal-cards-per-aspect and off-aspect-package rulings, and an `unmodeled` escape hatch that blocks seating), `linked.cardTitle` and `teamUp.names`.
  - **Questions for FFG:**
    - Identity sets with more than three copies of a title vs the three-copy rule. Black Panther's set has 5 "Wakanda Forever!"; the implementation holds signature cards to their set quantity.
    - Four vs five choosable aspects: 'Pool is implemented as the fifth.
    - "May" vs "must" choose an aspect: implemented as must.
  - **Follow-ups:** setup doesn't yet set Linked or Permanent cards aside, and MarvelCDB reprint codes (`duplicate_of_code`) will need mapping before real decklists import cleanly.
- **Interrupted, then restarted (2026-09-13).** Both agents below were cut off by an API usage limit. Fresh agents are continuing from the work left in the tree, which was checked first:
  - **Rules work that survived:**
    - about 670 lines of wave 1 schema, with `schema/wave1.test.ts` covering Wrecking Crew's lettered stages and four villains, Risky Business's double-sided villain stage cards, Mutagen Formula's X values, wave 1 attachment hosts, nemesis-minion markers, play restrictions, and the Invocation separate deck;
    - Invocation-deck legality tests in `engine/src/deck.test.ts`, with no implementation behind them.
    - It left four content type errors and a missing import that stopped `deck.test.ts` loading. `docs/phase7-wave1.md` was not started.
  - **Client work that survived, all tested (client 276 passing):**
    - decklist parsing (`@mc/content` `src/import/`) and the pool version;
    - saved-deck storage (its own `mc-decks` database);
    - the dev-only `/api/marvelcdb-import/*` route;
    - view models for the deck list, import and builder.
    - No scenes yet.
- **Local rules sources (2026-09-13).** The user added RRG 1.8 (`mc_rulesreference_v18_compressed.pdf`) and Hall of Heroes' transcription of official FFG rulings since RRG 1.7 (`marvel-champions-rulings-post-rrg-1-7.md`) to the repo root; CLAUDE.md now points at both. Entries that bear on current work:
  - **Aug 3, 2026, ruling 4:** Linked cards cannot be included in decks. Confirms `validateDeck`'s `linked_card` problem.
  - **Jan 17, 2026, ruling 5 (Wrecking Crew):** only the active villain's encounter deck can be interacted with. A card shuffled into "the encounter deck" goes into the active villain's, and a defeated nemesis minion goes to the active villain's discard. This settles the multi-villain encounter-deck model.
  - **Jan 26, 2026, ruling 4, #3:** when several players are dealt encounter cards at once (Green Goblin II's When Revealed), the first player chooses the order and players receive their cards in blocks, AABB or BBAA, never ABAB.
  - **Mar 19, 2026, ruling 6:** the deckbuilding half of the unique rule applies only during deck construction. Unique cards added at setup (Cameo, scenario rules) may share titles with cards in player decks.
  - **Jan 26, 2026, ruling 4, #6 and #7:** "Kang (The Conqueror)" and "Kang (Master of Time)" don't match (the parenthetical is part of the title, not a subtitle), and Valkyrie the hero doesn't match Valkyrie the ally (the hero's alter-ego title differs). Both are regression cases for `cardsMatch`.
- **Wave 1 schema and engine spec landed (`game-rules-architect`, 2026-09-13).** Verified by the main session: content, engine and cards typecheck clean, with content 186, engine 276 and cards 125 tests passing.
  - **Schema.** Every wave 1 card shape can now be represented; the final survey run found no gap left for the schema. It covers:
    - several villains in one scenario, with a signature side scheme per villain;
    - Wrecking Crew's versions A and B as consecutive stages;
    - villain stage cards with two faces, `startingSide` and `dashedStats`;
    - double-sided encounter cards;
    - `printedX` scheme values;
    - seven new attachment host kinds;
    - a nemesis-minion marker;
    - play restrictions: max per round, and identity-trait and controlled-character-trait requirements;
    - an identity's separate deck, the Invocation deck.
  - **Invocation deck legality.** Its cards may not be listed in a deck and don't count toward deck size; the identity defines them. They count as used for `unscriptedCards`, and the unique rule doesn't apply to them (ruling Mar 19, 2026 (6)).
  - **`docs/phase7-wave1.md`** has the schema decisions with citations, each pack's setup needs, and 15 engine primitives in priority order, starting with several villains and the active villain (`state.villain` becomes a list, read in 43 places), an encounter deck per villain with discard routing, and two-faced villain stage cards. It also lists eleven open questions.
  - **Raw-data errors curation must fix:** Pile It On! names the wrong villain; Black Widow and Synth-Suit are missing their errata; plus several typos (doc §1.12).
  - **Keywords.** No wave 1 card prints Team-Up, Find, Discount, Requirement or Teamwork. "Teamwork" (06032) is an event's title and must not parse as the keyword.
- **Decided by the user (2026-09-13): games saved before the multi-villain state change are retired, not migrated.** When that change lands, every older save is marked `incompatible` and no longer offered as Continue, the existing path for a save that no longer replays. This answers open question 11 in `docs/phase7-wave1.md`.
- **Decided by the user and confirmed against the rules (2026-09-13): each player assigns their own indirect damage.**
  - RRG 1.8 "Indirect Damage" (p. 24): damage dealt to a player "can be divided as that player chooses among characters under their control".
  - When the effect hits each player, "Each Player" (p. 17) has the players resolve it one at a time, in an order the first player picks when the card doesn't give one.
  - Every wave 1 indirect-damage card deals it to "each player" or "you": Green Goblin I–II, Pumpkin Bombs ×2, Electro, Lightning Bolt. None deals it to "the group".
  - When a later pack does, the RRG says it "can be divided as the group chooses", and "First Player" (p. 19) gives the first player the final say ("the players as a group are encouraged to work together, but the first player decides"). That decision goes to the first player's seat.
  - The rulings file has no ruling on who divides it; its only indirect-damage ruling (Aug 3, 2026 (2)) is about Echo.
  - This answers open question 7 in `docs/phase7-wave1.md`.
- **Phase 9 client landed (`game-client-engineer`, 2026-09-13), then verified and fixed in the browser by the main session.** Root typecheck is clean, and content 186, engine 276, cards 125 and client 296 tests pass.
  - **Built:**
    - a `SessionConfig` seat can carry a custom deck, and a `createGame` refusal keeps its engine code (`SetupError`) across the worker boundary;
    - Title seats offer every precon and saved deck, with seats that can't be played dimmed in place;
    - a Decks screen: a virtualized list with a status chip per deck, paste import, import by MarvelCDB link or id through a dev-only route, and delete;
    - a minimal deck builder;
    - `McMultilineInput` for pasting decklists;
    - focus routes for both new screens.
  - **Seen working in the browser at 800×600:**
    - importing MarvelCDB decklist 2416 by id through the dev route: "Black Panther (imported)", which the engine confirms is legal (40 cards, Protection, nothing unscripted) and saved against the current pool version;
    - that deck appearing as a Title seat;
    - a game started from it, dealing a real Rhino game that opened on Black Panther's Foresight choice.
  - **Four bugs found in the browser and fixed:**
    - **The paste field drew nothing.** It took keystrokes but never rendered. rexUI's `TextAreaInput` keeps its `GridSizer` and `CanvasInput` as separate entries in the scene's display list, and the Decks screen only kept the root object through each full redraw. `McMultilineInput.gameObjects` now returns every piece, and the Decks screen keeps them all.
    - **Status chips were colour only.** Each "LEGAL" label was created before its chip's fill, so it was drawn underneath it.
    - **A saved deck's status chip was hidden** under its Edit button. It now sits left of Edit and Delete.
    - **"Start game" was pushed off the bottom of an 800×600 window** by the extra seat row and "Manage decks…", and a canvas can't scroll. On wider screens "Manage decks…" now shares the seed row; the wordmark scales with window height as well as width; short windows get tighter margins. It fits with seven seats. **Still open:** every further saved deck adds a seat row, so Title needs a cap or a scrollable seat list before a player's collection grows.
  - **Also fixed:** a successful import was reported in error red. The banner now has a success tone and an error tone.
  - **The deck builder, seen and fixed.** Picking an identity, choosing an aspect (Spider-Man's pool went from 19 to 27 browsable cards), live problems in the engine's own wording, and add/remove all work.
    - **Fixed: a new deck started empty,** so the builder opened on ten problems, eight of them "X is missing" for signature cards the player had to add by hand.
    - `@mc/engine` now exports `requiredIdentitySet(identity, pool)`: the identity-set cards at their exact set quantities, leaving out Linked cards and separate-deck (Invocation) cards. `validateDeck` reads set membership from the same predicate, so the two can't disagree.
    - `newDeck` starts from it. A new Spider-Man deck now opens with 15 cards and two problems: choose an aspect, reach 40 cards.
    - Tested: for every Core precon the helper returns exactly that precon's signature cards.
  - **Not yet verified in the browser:**
    - paste import of a real MarvelCDB text export (the parser's format is inferred and was never checked against real export bytes);
    - Title rerouting an `illegal_deck` refusal to Decks;
    - both new screens on the phone layout, and their keyboard routes.
  - **Known gaps from the agent:**
    - rows can't be clicked to edit them, only through their Edit button;
    - no card-art thumbnails in the Decks or builder lists;
    - `McMultilineInput.focus()` reaches into rexUI internals;
    - the main bundle grew about 600 kB (to 2.22 MB) from rexUI's `TextAreaInput` and `CanvasInput`.
- **Sequencing.** Engine primitives waited for the client agent to finish; that condition is now met, and the engine work has started (below).
- **A transient cards failure, explained (2026-09-13).** Rhino's "Charge" test briefly failed: it couldn't find card `01099`. The data agent had re-emitted `src/data/core` mid-run and then reverted it. Core data matches HEAD again (checked staged and unstaged), all 125 cards tests pass, and the agent has been told to do any Core drift check in a temporary directory.
- **Stopped by the account's monthly spend limit (2026-09-13).** Both agents below ended early. Checked afterwards: root typecheck is clean and all 884 tests pass (content 186, engine 277, cards 125, client 296).
  - **Engine primitives:** not started. No engine files changed.
  - **Wave 1 data:** unfinished edits to `scripts/marvelcdb/normalize.ts` and `parse-text.ts`. No wave 1 curation files, no emitted `src/data/<pack>/` folders, no `WAVE1_*` pool, no precons. `src/data/core` still matches HEAD.
  - **Restage `scripts/marvelcdb/normalize.ts` before committing.** The staged copy uses raw NUL characters as map-key separators (`` `${type}<NUL>${name}` ``, at byte offsets 5,858 and 6,431). The code works, but git treats the whole file as binary and shows no readable diff. The working file has since switched to a space separator (`` `${c.type_code} ${c.name}` ``; `type_code` never contains a space, so keys can't collide) and has no control bytes, so `git add` it after reviewing.
  - **To resume** once the limit allows: re-run both briefs as fresh agents. Tell the data agent to review the unfinished `normalize.ts` and `parse-text.ts` edits first (keep them if they're sound, otherwise revert them) rather than starting over blind.
- **Wave 1 card data landed (`card-data-pipeline`, 2026-09-13).** Verified by the main session: `src/data/core` still matches HEAD; content (246 tests) and cards (151) typecheck clean and pass.
  - **Emitted:** eight packs to `src/data/<code>/`.
    - Hero packs: cap 34, msm 33, thor 34, bkw 33, drs 39, hlk 32, each matching its raw record count.
    - Scenario packs: gob 43 of 53 records, twc 55 of 60. MarvelCDB lists each villain stage and main scheme both as a combined record and as an a/b pair, and each is emitted once.
    - Aggregated as `WAVE1_CARDS`, `WAVE1_ENCOUNTER_SETS`, `WAVE1_SCENARIOS` and `WAVE1_STARTER_DECKS`, beside the unchanged `CORE_*` exports. The engine, `coreScenario` and the client still use Core only.
  - **Scenarios:**
    - Risky Business: Norman Osborn is the side up at setup, Green Goblin the other side.
    - Mutagen Formula: its B-side acceleration is printed as X.
    - Breakout: four villains in printed order, each with its own encounter set and signature side scheme.
  - **Curation corrections, each cited:**
    - Pile It On! names Piledriver, not Wrecker.
    - Held Hostage 07005: "attacked" → "attached".
    - Held Hostage 07036 / 07050: a missing apostrophe. Uncorrected, it silently parsed to a host naming a nonexistent card.
    - Black Widow and Synth-Suit: the "trigger" → "resolve" errata, via a new forward-errata mechanism (RRG p66; ruling Feb 28, 2026 (2)).
    - Electrostatic Armor: "Player under" → "Play under". Otherwise the restriction silently parses as plain text.
    - Title capitalization for "Strength in Numbers" and "Clash of the Titans", confirmed against the printed decklists.
  - **Pipeline fixes:**
    - three wave 1 fields missing from the emitter's key brands;
    - separate-deck cards exempted from the precon identity-set check;
    - a scenario's main scheme may live in a different set from its villain (Breakout);
    - scenarios may reference Core's Standard and Expert sets;
    - "When Completed" is now a recognized trigger.
  - **Reprint art:** a reprinted basic or aspect card with no image of its own resolves to its first printing in Core, matched by type and name. Every wave 1 reprint originates in Core.
  - **Precons.** Captain America (Leadership), Ms. Marvel (Protection), Thor (Aggression), Black Widow (Justice), Doctor Strange (Protection) and Hulk (Aggression) all pass `validateDeck` and `requiredIdentitySet` (`packages/cards/src/wave1-precon-legality.test.ts`). Doctor Strange's Invocation cards come from his identity's `separateDecks`.
    - **Provenance deviation, accepted:** each is marked `verified: true` on one source, the printed decklist on the deck's title card (Hall of Heroes photo, viewed only, not stored). The brief asked for `verified: false` with a single source. FFG's printed decklist is the primary evidence; no matching MarvelCDB decklist was found to cross-check.
  - **Still untrusted:** "Chaos In the Prison" (07011 / 07026 / 07056) may be a MarvelCDB capitalization error; there's no second source, so it's left as is.
- **Resumed (2026-09-13):** both tasks restarted as fresh agents. The data agent reviews the unfinished `normalize.ts` and `parse-text.ts` edits before building on them.
- **Engine primitives §3.1–§3.2 landed; the agent was stopped again by the spend limit partway into §3.3–§3.4 (checked 2026-09-13 by a new main session).** Root typecheck is clean and all 991 tests pass (content 246, engine 294, cards 151, client 300).
  - **§3.1 several villains and §3.2 an encounter deck per villain: done and tested** (`packages/engine/src/multi-villain.test.ts`, 18 tests on synthetic cards).
    - `GameState.villains` + `activeVillainId`; `encounterDecks` + `encounterDeckOrder` + `encounterSetAside`; `CardInstance.home` routes discards.
    - `setActiveVillain` effect, `activeVillainChanged` event, the "most threat, tie → first player" rule on defeat, the `allVillainsDefeated` win.
    - Core games unchanged; the client board model reads `activeVillain(state)`.
  - **Old saves retired, as decided:** `SAVE_SCHEMA` is 2; a schema-1 save is marked `incompatible` and never offered as Continue (`client/src/engine/session-core.ts`).
  - **§3.3–§3.4 partly written, untested:**
    - written: `flipVillain` / `flipCard` effect (`resolve/apply-effect.ts`), `CardInstance.flipped` and the flipped-face accessor, the `faceNamed` predicate, `dashedStats` read in `characterProfile`, double-sided cards removed from the game instead of discarded (RRG 1.8 "Double-Sided Card", p. 17), the `stateCheck` trigger kind, and `GameState.stateChecks`.
    - **not yet wired:** `resolve/state-checks.ts` `checkStateTriggers` is called from nowhere, so condition-triggered abilities never fire.
    - **no tests** for any §3.3–§3.4 item.
- **Engine primitives §3.3–§3.11 landed (`game-rules-architect`, 2026-09-13; the agent was stopped by the session limit before reporting, and this was verified by the main session).** Root typecheck is clean and all 1,070 tests pass (content 246, engine 373, cards 151, client 300). Engine test files went 25 → 33.
  - **Landed, each with its own test file:** §3.3/§3.4 two-faced villain stages, flipping encounter cards and edge-triggered state checks (`flip.test.ts`); §3.5 the Invocation separate deck (`separate-deck.test.ts`); §3.6 enemy-activation replacement, redirection, boost suppression and queued attacks (`activation-wave1.test.ts`); §3.7 indirect damage, each player assigning their own (`indirect-damage.test.ts`); §3.8 scheme values, When Completed and signature side schemes (`scheme-values.test.ts`); §3.9 boost cards as events (`boost.test.ts`); §3.10 play, cost and resource restrictions (`play-restrictions.test.ts`); §3.11 four new trigger events and seven rule specs (`triggers-wave1.test.ts`).
  - **Core is unchanged:** a new announcement only reaches the stack when an ability could react to it, so Core's event order and logs stay identical.
  - `docs/phase7-wave1.md` §3 now carries a per-section status note saying what landed and which test file proves it.
- **Engine primitives §3.12–§3.16 landed (`game-rules-architect`, 2026-09-13), verified by the main session: root typecheck clean, 1,116 tests pass (content 246, engine 419, cards 151, client 300). Every wave 1 engine primitive in `docs/phase7-wave1.md` §3 is now implemented, and each section carries a status note naming its test file.**
  - **Landed:** §3.12 selection and value vocabulary (`selection-wave1.test.ts`); §3.13 card movement and placement (`movement-wave1.test.ts`); §3.14 attachment host resolution, every §1.6 host kind evaluated at attach time (`attachment-hosts.test.ts`); §3.15 setup, with a per-villain `version: "A" | "B" | "extreme"` (`setup-wave1.test.ts`); §3.16 verification (`verify-wave1.test.ts`).
  - **A Core behaviour was corrected, deliberately.** Identity `Setup:` abilities used to resolve before the opening draw; RRG 1.8 Appendix II (p. 51) makes them step 16 — after Draw Cards (14) and Resolve Mulligans (15) — which is what makes Steve Rogers' "deck **and** discard pile" search meaningful (FAQ "Steve Rogers (#1B)", p. 59). They now run in a new `playerSetupAbilities` flow step. **Verified against the RRG text by the main session**, not taken on the agent's word. One engine test's prompt order flipped (`player-cards.test.ts`, same subject); Black Panther's Foresight in `@mc/cards` passes unchanged.
  - **§3.16 found two real gaps, both fixed:**
    - `CardSelector.zone` took a single zone, so "search your deck **and** discard pile" (Agent Coulson, Hail Hydra!, For Asgard!) could not be one choice. It now takes several.
    - **Stun vs an unlabeled multi-attack ability.** FAQ "Dance of Death (#4)" (p. 59): a stun prevents only the first of its three attacks. The engine only spent a stun on `(attack)`-labeled abilities and basic attacks, so an unlabeled attack effect ignored stun entirely. An `attack` effect now checks the attacker's stun at initiation. **Core is unaffected:** `dsl/validate.ts` `checkLabels` refuses an attack effect on an ability without an `(attack)` label, so no Core script can reach that path.
  - **Readings taken** (each isolated, easy to change): §4.6's extreme challenge as the doc proposes (`VERSION_STAGES` in `setup.ts`); a superlative tie resolves to every tied card, with `chooseTarget { inSlot }` breaking it the way §3.1 does; `ignoreTough` leaves the tough status card in place (piercing is the keyword the RRG defines as discarding it, p. 44); `setRemainingHitPoints` is not a heal. §4.2, §4.4 and §4.5 were not touched.
  - **Follow-ups for `ability-scripting-engineer`, before the cards that need them can be scripted:**
    - `dsl/validate.ts` `checkLabels` needs an opt-out, or Dance of Death (no printed `(attack)` label) cannot be written.
    - `dsl/validate.ts` `bindsOf` doesn't know `discardEncounterCards.bind`, so a script reading `<bind>.count` is wrongly flagged.
    - `PlayerZone` is defined in `spec.ts` but not re-exported from `@mc/engine`'s `index.ts`; a consumer outside the engine can't name the type yet.
- **Wave 1 scripting foundation and Captain America (`cap`) landed (`ability-scripting-engineer`, 2026-09-13).** Two agents were cut off by usage limits along the way. The main session checked the tree afterwards: root typecheck is clean, and all 1,152 tests pass (content 246, engine 426, cards 178, client 302).
  - **The three follow-ups above are done:**
    - `allowUnlabeledAttack(definition, { citation })` in `dsl/validate.ts` is a named opt-out that requires a citation, never a blanket relaxation;
    - `discardEncounterCards` is a card-binding effect in `bindsOf`;
    - `PlayerZone` is exported.
  - **Layout.** `packages/cards/src/wave1/`:
    - one folder per pack, with its own `<PACK>_ABILITIES`;
    - `wave1/index.ts` merges them into `WAVE1_ABILITIES` / `WAVE1_DEPS`, one line per pack, which the main session adds when it integrates a pack;
    - `wave1Scenario` for setup, with helpers in `wave1/testing.ts`;
    - all of it exported from `@mc/cards`.
    - The client still uses Core only.
  - **Reprints.** `wave1/reprints.ts` gives a wave 1 card that is the identical Core card by name and type its Core ability automatically. `mergeRegistries` throws if a pack script defines one again.
  - **Coverage.** `wave1/coverage.test.ts` derives the pack list from `@mc/content`'s exports and asserts that `cap` is fully scripted: 34 cards, 37 ability references, 0 unscripted, 6 of them Core reprints. The other seven packs resolve nothing beyond reprints.
  - **Tests.** `cap/captain-america.test.ts` has per-card tests, including both branches of Man Out of Time. `cap/e2e.test.ts` plays the Captain America (Leadership) precon against Rhino to an outcome with the greedy driver and replays it deep-equal.
  - **Six failing tests and one type error at the hand-off were all test bugs.** No script or engine change was needed. For example, Agent 13 (03002) is printed S.H.I.E.L.D. only, so Avengers Tower's test now uses Squirrel Girl (03013), an Avenger. A Response always leaves a `chooseTriggers` choice to settle.
  - **New engine primitives, added while scripting `cap`, all general-purpose:**
    - costs `exhaustTarget`, `returnToHand` and `exhaustChosen`, plus an optional `max` on `discardFromHand`;
    - `costReduction.cardFilter` and a conditional `allyLimit.while`;
    - `TargetQuery.withoutTrait` and `maxPrintedCost`;
    - `scaled.divideBy`, the `countInRef` value, and `<bind>.boostIcons`;
    - tests in `engine/src/target-cost.test.ts`.
    - **Reviewed by `game-rules-architect` (2026-09-13).** The main session verified the result: typecheck clean, 1,172 tests passing (content 246, engine 441, cards 183, client 302). It also checked the review's three rules claims against the RRG 1.8 text: the "Cost" minimum of one, "Ally Limit" "ever controls", and "Modifiers" rounding fractions up.
      - **Reshaped:**
        - `exhaustTarget` / `exhaustChosen` / `returnToHand` are now one in-play pick shape, `InPlayCostPick { slot, query, min, max?, bind? }`.
          - DSL: `exhaustCardsCost(q, { min?, max?: n | "any" })` and `returnToHandCost`.
          - The engine only considers cards in play that you control and that can pay. A pick with only one possible answer pays itself.
        - `scaled.divideBy` is now `divide: { by, round: "down" | "up" }`, with `round` required. RRG "Modifiers" rounds fractions **up** by default, so the old "always floor" was wrong for any card that doesn't print "rounded down".
      - **Bugs fixed,** each with a test in `target-cost.test.ts` (now 22):
        - a same-named card controlled by another player hid your own copy;
        - a card in hand was accepted as an in-play pick;
        - a zero-card "any number" cost was allowed (RRG "Cost": minimum of one);
        - one card could pay two parts of a cost;
        - a card that can't leave play could be returned to hand as a cost;
        - legal actions never offered an ability whose pick had several possible answers.
        - The ally limit was checked only when an ally entered play. RRG "Ally Limit" says "if a player ever controls" too many, so `checkAllyLimits` now also runs from `checkStateTriggers`.
      - The validator now rejects `min` < 1 on in-play picks, duplicate cost slots, and a malformed `divide`.
      - **Open, no ruling found:**
        - Four Avenger allies plus Avengers Tower, then a non-Avenger enters play: the engine asks for 2 discards at once, though discarding the non-Avenger first would restore the limit of 4.
        - "Each of your allies" with no allies is read as true.
        - Shield Toss with X = 0 is allowed.
        - Interrupt and response windows pay costs without picks, so a triggered ability whose in-play pick has several answers isn't offered. No wave 1 card is known to need this yet.
        - A card's own exhaust cost isn't checked against a resource ability on the same card. This predates wave 1 and was left alone to keep Core unchanged.
      - **Client follow-up (`game-client-engineer`):** `client/src/scenes/board/selection.ts` only fills `payPrintedCostOf` picks. `exhaustCards` / `returnToHand` need a picker before Strength in Numbers is usable in the UI.
  - **Per-pack brief:** `docs/phase7-wave1-scripting.md` covers the layout, registration, reprints, test pitfalls, "missing primitive → record and skip", the primitive table and per-pack status.
  - **A concurrent session shares this working tree.** A separate Claude session is fixing client bugs in the same checkout: attached upgrades (Focused Rage, Web-Shooter) not readying in `engine/src/flow.ts`, confirm-button selection in `client/src/view/choice-focus.ts` and `scenes/choice.ts`. Those edits are its own, not wave 1's; check whose files are whose before committing.
- **Running now (2026-09-13): seven `ability-scripting-engineer` agents in parallel,** one each for `msm`, `thor`, `bkw`, `drs`, `hlk`, `gob` and `twc`.
  - **All share this working tree.** Worktrees would branch from the last commit, which doesn't have the uncommitted `cap` foundation. So each agent writes only in `packages/cards/src/wave1/<pack>/`.
  - **Missing engine or DSL pieces are recorded and the card skipped,** not added, so the agents never collide in `spec.ts`.
  - **Each agent tests against local deps** (`mergeRegistries(WAVE1_ABILITIES, <PACK>_ABILITIES)`) and runs only its own folder's tests plus the cards typecheck.
  - **The main session integrates each pack:** its `wave1/index.ts` registry line, the status table in `docs/phase7-wave1-scripting.md`, and this file.
  - **Usage limits interrupted the batch twice (2026-09-14).** All seven agents stopped before writing anything, then Ms. Marvel, Thor and Hulk stopped again partway through. The packs now run at most three at a time, resumed with their context intact, in the order `msm`, `thor`, `hlk`, then `bkw`, `drs`, `gob`, `twc`.
  - **Thor (`thor`) landed and is registered (2026-09-14).** The main session verified it: 28 tests pass in `wave1/thor/`, nothing was written outside the folder, and both skipped cards' printed text matches the agent's report.
    - 34 cards; every ability ref resolves except 2 recorded skips, pinned in `wave1/coverage.test.ts` `KNOWN_SKIPPED`, which now allows a scripted pack a documented skip list.
    - **Missing primitives for the batch:**
      - Mean Swing (06015) needs a host filter on `TargetQuery` ("a Weapon upgrade on your hero").
      - Valkyrie's Response (06012) doesn't receive her own `paid.*` vars, because a Response to a card's own entering play gets a fresh frame.
    - **DSL gap:** `wave1/thor/local.ts` wraps engine effects that are landed but have no DSL builder (`engage`, `reorderCards`, `distinctCardTypes`, `dealDamage.ignoreTough`). Promote them into `dsl/` when the batch lands, so packs don't each copy them.
    - **Not a gap:** a hero's nemesis set stays set aside in a plain game until an effect like Shadow of the Past brings it in, so Thor's nemesis cards are unit-tested by moving them onto the encounter deck in the test setup.
  - **Ms. Marvel (`msm`) landed and is registered (2026-09-14).** The main session verified 26 passing tests in `wave1/msm/` and found nothing written outside the folder.
    - **Coverage.** 33 ability refs: 26 scripted, 3 Core reprints, 4 recorded skips pinned in `wave1/coverage.test.ts` `KNOWN_SKIPPED`.
    - **Missing primitives, for the batch:**
      - `TargetQuery.anyTrait` (Morphogenetics 05001a);
      - a player-deck `discardDeckUntil` (Teen Spirit 05001b);
      - a `ValueSpec` sum (Generation Why? 05026).
    - **Confirmed engine bug, for the batch:** the `attack` case in `resolve/apply-effect.ts` never adds `cardEffectBonus`, while `dealDamage`, `thwart` and `removeThreat` do. This blocks Embiggen! (05010).
    - **Refuted.** The agent said a nemesis set should come into play automatically when the identity's obligation is discarded. RRG 1.8 "Nemesis Encounter Set" says the cards are set aside at the start of the game and "Cards drawn from the encounter deck may instruct the player on how to bring their nemesis set into play". So keeping it set aside is correct. Nemesis-set tests stage those cards themselves.
  - **Changed by the user (2026-09-15): packs land one at a time, not in parallel.** Parallel agents kept exhausting the usage limit, most recently Hulk, Black Widow and Doctor Strange together. Black Widow and Doctor Strange are paused with partial folders.
  - **Hulk (`hlk`) landed and is registered (2026-09-15).** The agent stopped at "All 20 tests pass", just before its typecheck.
    - **Finished by the main session:** `hlk/e2e.test.ts` (Hulk vs Rhino: a loss in round 4, replayed deep-equal) and `hlk/coverage.test.ts`. Neither was in the folder.
    - **Coverage:** 32 cards. Every ability ref resolves except 3 skips, pinned in `wave1/coverage.test.ts` `KNOWN_SKIPPED`.
    - **Missing primitives, as the agent traced them** (not yet re-checked; `game-rules-architect` verifies in the batch):
      - **Hulk Smash (10003):** a player attack never reads overkill granted by an interrupt; `applyPlayerAttack` vs `enemy-activation.ts`.
      - **Clash of the Titans (10028):** `dsl/validate.ts` rejects `superlative`'s implicit `candidate` slot. This blocks any "the X with the highest/lowest Y" card, likely including some in `gob` and `twc`, so fix it before those packs.
      - **Beat Cop's second action (10029):** `discardSelf` doesn't snapshot threat.
  - **Black Widow (`bkw`) landed and is registered (2026-09-15).** The scripts were written before the usage limit. A fresh agent then reviewed them against the printed and errata'd text, and wrote the tests.
    - **Found and fixed:**
      - Agent Coulson (08011), Quake (08012) and Stealth Strike (08013) had no scripts at all. They're written now.
      - Burn Notice (08025) used `superlative`. The validator rejects that at import time, which broke the whole `BKW_ABILITIES` registry. It's now a recorded skip.
    - **Skips, pinned in `KNOWN_SKIPPED`:**
      - Taskmaster's boost (08026): `modifyAttack` can only bonus the current activation's own attacker.
      - Burn Notice (08025): the `superlative` validator gap.
    - **Tests:** 25 in `wave1/bkw/`. The e2e test, Black Widow (Justice) vs Rhino, is a win in round 12 and replays deep-equal.
    - **The `superlative` validator gap has now blocked two packs** (Clash of the Titans, Burn Notice). Fix it before `gob` and `twc`.
  - **The `superlative` validator gap is fixed (main session, 2026-09-15).** It was blocking a card in two landed packs and was about to hit Doctor Strange's Thoughtcasting.
    - **The fix:** `dsl/validate.ts` `checkRefs` now checks a `superlative`'s `among` in the current scope, and its `measure` with the ref's own slot (`candidate` by default) added. The slot stays unreadable anywhere else. Tests are in `dsl/validate.test.ts`.
    - **Restored with tests:**
      - **Burn Notice (08025, `bkw/obligation.test.ts`).** It discards the highest-cost Preparation card, and a tie is the player's choice via `chooseTarget { inSlot }`. Staying in hero form, only the discard branch can be paid, so it resolves without a prompt.
      - **Clash of the Titans (10028, `hlk/clash-of-the-titans.test.ts`).** In alter-ego form with Brawn in play, Rhino attacks Brawn. Ties go to the first player's choice, and the card surges if no attack was made.
    - **Skips now:** `bkw` 1 (Taskmaster's boost), `hlk` 2 (Hulk Smash, Beat Cop).
  - **Doctor Strange (`drs`) is running (2026-09-15).** It's a fresh agent and the only one running. It builds on the partial folder: kit and nemesis scripts, plus the recorded Physical Toll skip, which needs a cost increase with no phase or round duration.
  - **Doctor Strange (`drs`) landed and is registered (2026-09-15).** Verified by the main session: nothing written outside the folder, typecheck clean, and all wave 1 tests pass (189, across 29 files).
    - **Tests:** 33 in `wave1/drs/`. The e2e game resolves at least one Invocation card.
    - **Skips, pinned in `KNOWN_SKIPPED`:**
      - Vapors of Valtorr (09035): no query for "has any status".
      - Physical Toll (09027): no cost modifier without a phase or round duration.
      - Counterspell (09030): a cancelled play doesn't stop the card's own effects.
      - Unflappable (09020): a Response's cost can't depend on "and take no damage".
      - Desperate Defense (09015): the `defended` bug below.
    - **The agent fixed Thoughtcasting.** `chooseTarget { inSlot }` only matches cards in play, so a pick from hand silently did nothing. It now uses `chooseCards`. The scripting doc's guidance is corrected: `chooseTarget` for cards in play, `chooseCards` for cards out of play.
    - **Confirmed engine bug, for the batch:** `isAnnouncement` (`engine/src/trigger-events.ts`) doesn't list `defended`, so the event only opens a response window and an Interrupt on `when.defends` never fires.
      - Blocks Desperate Defense (09015).
      - **Captain America's Expert Defense (03033) has the same shape and is registered as scripted, but is untested and almost certainly never fires.** Fix and test it with the batch.
  - **Green Goblin (`gob`) is running (2026-09-15):** a fresh agent, the only one running, in an empty folder.
  - **Green Goblin (`gob`) landed and is registered (2026-09-15).**
    - **Scope:** Risky Business, Mutagen Formula and the 4 modular sets, with 31 tests.
    - **E2E:** both scenarios, solo and 2-player, reach an outcome and replay deep-equal.
    - **Verified by the main session:** nothing written outside the folder, typecheck clean, and all wave 1 tests pass (220 across 34 files).
    - **Two problems surfaced on registration:**
      - **Gang-Up (02039) was hand-scripted.** It's a Core reprint that `reprints.ts` already aliases, so `mergeRegistries` threw "defined twice" and every wave 1 test file failed to load. The pack's local deps used an object spread (`{ ...WAVE1_ABILITIES, ...GOB_ABILITIES }`), which silently hid the collision in its own tests. The duplicate entries are removed. Local deps must use `mergeRegistries`, never a spread.
      - **The shared coverage test missed back-face refs.** `wave1/coverage.test.ts` `abilityRefIds` ignored a double-sided encounter card's `flipSide.abilities`. It now counts them.
    - **8 skips:**
      - **Criminal Enterprise / State of Madness (02006a/b), a `card-data-pipeline` item.** The data gives one ability ref per face, but each face needs two triggers.
      - **Hired Gun (02007), Intimidation (02035):** no "give the villain a boost card" outside an activation.
      - **Power Drain (02041), Lightning Bolt (02044), Shock Therapy (02045):** boost icons summed across discarded cards. Likely scriptable already via `moveCards`'s summed `<bind>.boostIcons`; retry these with the batch.
      - **Tombstone (02047):** no filter for either of two resource types.
    - **Shared setup gap:** `wave1Scenario` delegates to `coreScenario`, which only looks up `CORE_SCENARIOS`, so it can't build a wave 1 scenario. Green Goblin works around it with a local `gobScenario`. Fix it in `wave1/setup.ts` before `twc`.
  - **The Wrecking Crew (`twc`) landed and is registered (2026-09-15). All eight wave 1 packs are now scripted and registered.**
    - **Scope:** Breakout with Wrecker, Thunderball, Piledriver and Bulldozer, 29 tests. E2E solo and 2-player reach an outcome and replay deep-equal.
    - **Shared setup fixed by the agent.** `wave1Scenario` now builds any wave 1 scenario: single-villain Risky Business and Mutagen Formula, and multi-villain Breakout with per-villain encounter decks, signature side schemes and versions. Core ids still go to `coreScenario`. Green Goblin's local `gobScenario` is deleted.
    - **Verified by the main session:** nothing written outside the allowed files, typecheck clean, and the whole `@mc/cards` suite passes (382 tests across 56 files, Core included).
    - **9 skips:**
      - Hard Hitter, Gamma Blast, Pile Drive, Charge: no predicate for a scheme's current threat against a threshold.
      - Magic Crowbar, Ball and Chain, Bulldozer's Helmet: no random discard from hand as a cost.
      - Radioactive Buildup: no redirect of an enemy attack's excess damage to a scheme.
      - Thunderball's boost: no ref for "the defending character".
  - **Wave 1 scripting status (2026-09-15):** 8 packs registered, **31 recorded skips** (thor 2, msm 4, hlk 2, bkw 1, drs 5, gob 8, twc 9) pinned in `wave1/coverage.test.ts` `KNOWN_SKIPPED`, plus one registered card known broken: Captain America's Expert Defense (the `defended` interrupt bug). The client still runs Core only.
  - **Next:** the main session gathers the recorded missing primitives across all seven packs and hands them to `game-rules-architect` as one batch, then the skipped cards, then rules QA (`rules-qa-engineer`).
- **Not started:** scripting the other seven wave 1 packs, and every client screen still reads the Core pool only — scenario choice, seats, the deck list, the deck builder and Inspect, and the engine the client runs is given Core's cards and scripts. Wave 1 is data and engine rules only; nothing of it is reachable in the UI yet.
- **Running now:**
  - `card-data-pipeline`: curations for the eight wave 1 packs, parser and normalizer support for the wave 1 schema, a reprint art policy, emitted `src/data/<pack>/` modules and a `WAVE1_*` pool beside the unchanged `CORE_*` exports, and the six wave 1 hero precons checked with `validateDeck`.
  - `game-rules-architect`: the wave 1 schema (several villains at once and Wrecking Crew's A/B stages, Green Goblin's Norman Osborn side, Doctor Strange's Invocation deck, attachment hosts, wave 1 keywords), plus the engine design spec `docs/phase7-wave1.md`.
  - `game-client-engineer`: the pool version, decklist parsing (`@mc/content` `src/import/`), a dev-only MarvelCDB import route, saved decks, and the Setup, Decks and deck-builder screens.
- **Next:**
  - Curate and ingest the wave 1 packs (`card-data-pipeline`), then the wave 1 engine rules, then card scripts (`ability-scripting-engineer`), then rules QA.
  - Per-hero precons.
  - The remaining 54 packs as data.

**Pack survey (2026-09-13, `card-data-pipeline`).** New tooling:
- `scripts/marvelcdb/survey.ts` does a dry-run normalization of any or all packs and produces a categorized gap matrix.
- `ingest-marvelcdb.ts` gains `--all`, `--dry-run` and `--allow-bare`, a curation registry keyed by pack, and a default output folder of `src/data/<pack>/`.
- Schema-neutral fixes: three missing icon tokens (`icon-boost`, `icon-crisis`, `icon-per_group`) that crashed normalization, and `player_side_scheme` now reaches the existing `PlayerSideSchemeCard` type.

Findings:
- **No non-Core pack normalizes without hand curation: 0 of 62.** Core only normalized because `curation/core.ts` corrected it card by card. So "all packs as data" means per-pack curation work, not a bulk conversion.
  - **Order:** wave 1 packs are curated first, because scripting needs them. The remaining 54 packs follow.
- **Largest gaps:**
  - 534 missing art references, mostly benign: MarvelCDB gives reprinted basic cards no image. The "every face has art" rule was written for a set where every card was a first printing.
  - 359 attachment host rules the parser can't read: trait-qualified ("an Avenger ally"), negated, "a scheme", conditional named hosts.
  - 137 cards missing `deck_limit`, and 99 with an unknown `campaign` faction: campaign reward cards.
  - 37 unknown card types: `leader` (Civil War, Synthezoid), the Agents of S.H.I.E.L.D. `evidence_*` cards, and third hero faces.
  - 33 villain stage labels that aren't roman numerals: Wrecking Crew uses `A`/`B`.
  - 19 hero-kit cards outside their hero's card set: Doctor Strange's Invocation deck and others.
  - 7 A/B main-scheme mismatches, the same trap Core needed curating for: Hood, Mad Titan's Shadow, and Mutant Genesis ×3.
- **Keyword gap, a correctness risk.** Team-Up, Find, Discount, Requirement and Teamwork exist in `schema/keywords.ts` but not in `parse-text.ts`. A card using them is silently read as plain constant text rather than failing.
- **What wave 1 needs from the schema and engine:**
  - multiple simultaneous villains, and what Wrecking Crew's `A`/`B` stages mean;
  - Doctor Strange's Invocation deck, a named sub-deck both in data and as an engine zone;
  - trait-qualified attachment hosts;
  - the keyword parsing above;
  - an art policy for reprints;
  - Green Goblin's Norman Osborn side.
- **Precons:** each hero's Hall of Heroes "Starter Deck" link is a photo of the printed decklist. Plan: cross-check it against a MarvelCDB decklist and record both in curation, as Core did. This is per-hero hand work.
- **Corrected after checking the agent's report:**
  - *"Green Goblin's raw data is untrustworthy" is wrong.* Norman Osborn's two stages (`02001a`, `02002a`) are `hidden` cards that MarvelCDB nests inside the Green Goblin records. They are complete (88 fields, with stats and text), and all 328 links to cards that aren't top-level records point at nested objects. The scraper does not need to fetch linked cards separately.
  - *A third hero face is not a wave 1 blocker.* Ant-Man, Wasp, Angel and SP//dr are later packs.
  - *Adam Warlock is not missing from the refetch.* MarvelCDB's own pack index (63 packs) doesn't list him.
  - The agent briefly wrote into `src/data/core` and reverted it with `git checkout`. It was confirmed identical to what's committed afterwards.

## Phase 8 — Polish

- [ ] Tutorial/onboarding flow for players unfamiliar with the paper game.
- [ ] Save/resume, settings, difficulty (standard/expert per the paper game's modes). **Local save/resume landed 2026-09-12** (IndexedDB, resumed by replaying the saved log — see Phase 4, "saved games and game over"); settings remain.
- [ ] Audio/feedback pass, performance pass, platform packaging as decided in Phase 0.
- [ ] Backlog, moved out of Phase 4 on 2026-09-11: **hero AI** to fill seats with computer-controlled heroes. It needs real planning, not the greedy test driver in `packages/cards/src/testing/driver.ts`. It should issue ordinary commands, so a seat can switch between human, AI and (Phase 5) a remote player.

## Phase 9 — Decks: precons, MarvelCDB import, and the deck builder

Owner: `card-data-pipeline` (deck schema, precon ingestion, import/normalization), `game-rules-architect` (deck legality — it is a rules question), `game-client-engineer` (the builder and import UI), `content-release-tracker` (precons as new packs release).

**Numbered last, but not sequenced last.** It depends only on Phase 4's client and can begin as soon as that lands; it is independent of Phase 5 (multiplayer) and Phase 6 (rules QA). Its *value* scales with Phase 7, because most decks people actually share use cards outside the Core pool — which makes the "this deck needs cards we don't have yet" path (below) the feature's most-travelled one until Phase 7 is well along, not an edge case.

Today a game can only be seated from the six hardcoded `CORE_STARTER_DECKS`. Three things are wanted: every official **precon**, decks **imported from MarvelCDB**, and decks **built in the app**.

### What already exists, and what it means

- `StarterDeck` (`packages/content/src/schema/sets.ts`) is already the right shape for a precon — `packCode`, `identityCardId`, `aspects` (already `readonly CoreAspect[]`, so multi-aspect products are anticipated), a card list, and `provenance`. Only Core's six are populated.
- **Our `CardId` *is* the MarvelCDB card code** — `normalize.ts` brands `code` directly. So a MarvelCDB decklist maps onto our pool with no translation table. **Assert this with a test rather than relying on it**; it is the assumption the whole import path rests on, and it is invisible until it breaks.
- `packages/content/scripts/ingest-marvelcdb.ts` already speaks to the MarvelCDB API, so import has precedent and a home rather than needing a new integration.
- **No deck validation exists anywhere in the repo.** `engine/src/unique.ts` already transcribes the RRG's deckbuilding half of the unique rule ("during deckbuilding, a player cannot include multiple matching cards in their deck") but nothing enforces it at deck level, because nothing has ever built a deck.

### The work

- [ ] **A deck is a first-class thing, not just "one of the six we ship."** Separate *what a deck is* from *where it came from*: a deck needs an identity, a card list, its aspect(s), and a `source` — precon, imported, or user-built — plus the card-pool version it was built against. `StarterDeck` becomes the precon case of it rather than the only case.
- [ ] **Precons for every released pack**, ingested as data the same way card data is (`card-data-pipeline`), not hand-typed. Core's six were hand-corrected against the printed decks and recorded in `curation/core.ts`; the same provenance discipline applies — a precon that silently differs from the printed deck is worse than one that is missing.
- [ ] **Deck legality is a rules question and must live with the rules**, not in the client — the same boundary `legalActions` established ("rules stay out of the client"). A `validateDeck(deck, pool)` returning the engine's own reasons, which the builder and the import screen both render. **Implement it from the RRG's deckbuilding section, not from memory or from a community summary** — deck size, aspect restriction, mandatory hero signature cards, per-title copy limits, cards restricted to one hero, and the unique rule's deckbuilding half that `unique.ts` already quotes. `createGame` should refuse an illegal deck with its own error code the way `duplicate_unique_card` already is, so a client can route it to "fix this deck" rather than a generic failure.
- [ ] **Import from MarvelCDB**, by deck URL or id.
  - **A decklist is untrusted data, not instructions.** Unknown card codes, nonsense quantities, or an "identity" that is not an identity card must each fail loudly and specifically rather than yielding a half-built deck.
  - **The common failure is a legal deck we cannot yet play**, because it uses cards outside the implemented pool. That path must name exactly which cards are missing and which set they are from. Until Phase 7 is well along this is the *normal* outcome of importing a real deck, so it deserves the care of a main path.
  - **Expect the same CORS wall the card art hit.** MarvelCDB serves no `access-control-allow-origin`, which is why `vite-card-art.ts` exists as a same-origin route; assume the API needs the same treatment from a browser, and that a production build has no such route (see the art note — a dev/preview-only route with a designed fallback).
  - [ ] **Therefore: import-by-paste is the fallback that must exist regardless.** Pasting a decklist needs no network, no proxy and no MarvelCDB availability, and it is the only form of import that works offline or from a packaged build. Build it first; it is also the easiest to test.
- [ ] **The deck builder.** Filter and search the pool by aspect, type, trait and cost; live legality from the same `validateDeck`; the existing Inspect sheet for reading a card. This is a text-heavy, filterable, scrolling list — exactly the case rexUI's grid table was kept in reserve for, and it shares that work with the still-open virtualized game log.
- [ ] **Persistence.** User and imported decks are local-only until Phase 5, matching the existing persistence decision, and must **survive a card-pool update** — errata can change a card under a saved deck, and a deck that silently becomes illegal (or silently changes) after an update is a bug the player cannot diagnose.
- [ ] **The Setup screen stops being "pick one of six."** Seats become "any legal deck", with precons as the obvious default so the fastest path to a game does not get slower.

### Decided (2026-09-13)

- **Illegal decks are always enforced.** An illegal deck can be saved and edited but not seated; there is no solo opt-out.
- **Import:** paste works everywhere. Import by MarvelCDB URL or id goes through a dev/preview-only same-origin route, with paste as the fallback.
- **Decks record the card-pool version** they were built against.
- **No taboo list** for now.
- **Multi-aspect rules are still open.** `validateDeck` is being written from the RRG's text rather than assuming one aspect per deck.

### Decisions to settle before building

- **May a player knowingly play an illegal deck?** Several digital implementations allow it for solo play and testing. It is a product call, not a rules one — the RRG simply says what a legal deck is. Default to enforcing, and decide deliberately whether to offer an opt-out rather than letting one appear by accident.
- **Taboo list support.** Hall of Heroes tracks an unofficial taboo list and MarvelCDB decks can be built against one. Decide whether a deck records the list it was built under, or whether this stays out entirely.
- **Multi-aspect deckbuilding.** `StarterDeck.aspects` is already a list, and post-Core cards change what aspects a deck may draw from. Read the RRG before `validateDeck` assumes one aspect per deck.
- **Do decks pin a card-pool version?** Related to persistence above: a deck is a list of card ids, but the cards those ids name can change under errata.

### Exit criteria

- [ ] Every precon for the implemented card pool is selectable at Setup and plays to an outcome.
- [ ] A public MarvelCDB deck imports, validates and plays; a deck needing unimplemented cards fails with the exact missing cards named; a malformed or hostile decklist fails safely.
- [ ] A deck built in the app validates against the RRG's rules, persists, survives a card-pool update, and plays.

## Non-goals (for now)

- No deckbuilding **marketplace**, no online ranked ladder, no monetization — this is about a faithful, playable simulation of the paper game, not a live-service product. (A deck *builder* and deck *import* are in scope — see Phase 9. The non-goal is the storefront and the social graph around decks, not the ability to build one.)
- No attempt to reimplement every cycle on day one — breadth comes after Phase 1–2 prove the engine approach is right on a small, well-understood card pool.
