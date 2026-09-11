# PLAN: Marvel Champions Digital Edition

Status: **Phases 0–3 complete; Phase 4 (client) is next. Client stack decided: pure Phaser 4 with rexUI, no DOM UI framework (see Phase 4).** Phase 2: Core Set ingestion, the §3 engine primitives, the `@mc/cards` ability DSL, all 233 Core ability scripts, `coreScenario()` builders, and real-content e2e games (spec: [docs/phase2-core-set.md](docs/phase2-core-set.md)). **Phase 3: the villain phase lives in `packages/engine/src/villain/`. Every decision the villain side leaves open is routed to the player the RRG names, and tagged with a `PendingChoice.authority`. `auditVillainPhases` independently re-checks each villain phase of a recorded game. 48 scripted games plus 3 passive-table games play to an outcome with clean audits (spec: [docs/phase3-encounter-ai.md](docs/phase3-encounter-ai.md)).** Stack recorded in CLAUDE.md; monorepo scaffolded (`packages/engine`, `packages/content`, `packages/client`); card schema landed in `@mc/content` (see its README for the rules-shape decisions); the headless engine runs full games from setup to win/loss against stub content; `pnpm test` / `pnpm typecheck` green. Update the Status line and check off phases as work lands.

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

Decided 2026-09-11. It was first decided as a Phaser table inside a Lit app, then revised the same day. `@mc/client` is a Vite + TypeScript app built on **Phaser 4** (released 2026-04-10; start on the 4.1.x line). Its UI toolkit is **rexUI**, via the `phaser4-rex-plugins` package. Phaser draws every screen, the table and every overlay; there is no DOM UI framework.

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
  - A new `legalActions(state, deps, playerId)` query returns:
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
- [ ] **Villain phase as a walkthrough.** The engine runs a whole villain phase inside one command. The designs' five-step, auto-advancing villain-phase screen ("auto-advance paused for your interrupt") has to be replayed from that command's `GameEvent` stream. It pauses at each `PendingChoice` and labels encounter-side decisions using `PendingChoice.authority`. The events and the authority tag already exist; this is client work.
- [ ] **Hero seats: one human plays every seat** (decided 2026-09-11).
  - Phase 4 supports multi-handed solo: one human controls 1–4 heroes, much as many people play the paper game solo.
  - **The board's perspective follows whoever must act:** the active player (`step.activePlayerId`) during turns, or the player a pending choice is addressed to (`pendingChoice.playerId`) while one is open.
  - Every `resolveChoice` is still issued as the player the engine names, so the command log stays identical to a real multiplayer game and Phase 5 needs no rework.
  - **The mocks' "Seat · AI" becomes "Seat · you".**
  - **Hero AI is not in Phase 4** (backlog item under Phase 8). Phase 3's villain side is procedure, not AI, and the greedy test driver isn't good enough to be a player-facing opponent.
- [ ] **Out-of-scope screens in the mocks.** Collection/deckbuilding beyond the preconstructed decks, and Campaign (marked locked in the mocks), stay out of Phase 4 unless re-scoped.

### Checklist

- [ ] Reference point: *Sentinels of the Multiverse* (digital edition) — a 2D tabletop-style card game, not a 3D physical simulator, playable cross-platform. Board/zones/cards are the primary UI; chrome (log, phase tracker, counters) supports it rather than replacing the tabletop feel.
- [ ] Board layout: player area(s), villain area, main scheme, side schemes, encounter deck/discard, each player's identity/hand/deck/discard/play area — legible at a glance the way the physical table is.
- [ ] Card rendering (using licensed-for-personal-use art per the IP boundary in CLAUDE.md), zoom/inspect, legal-move highlighting, drag-and-drop or tap-to-target interaction for choosing targets/attachments/assignments.
- [ ] Animations/feedback for damage, threat, defeat, phase transitions — enough to make state changes readable, not spectacle for its own sake.
- [ ] Accessibility pass: colorblind-safe indicators (damage/threat/keywords shouldn't rely on color alone), readable type sizes, keyboard/controller navigation if platform requires it. Scope per the stack decision above: keyboard and gamepad focus navigation, colorblind-safe indicators, minimum sizes and reduced motion. Screen readers are out of scope for the canvas client.
- [ ] Exit criteria: a solo human player can play a full Core Set scenario against the AI villain from the Phase 3 engine, entirely through the UI, with no engine internals exposed. That covers one hero, or 1–4 heroes played multi-handed.

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
- [ ] Backlog, moved out of Phase 4 on 2026-09-11: **hero AI** to fill seats with computer-controlled heroes. It needs real planning, not the greedy test driver in `packages/cards/src/testing/driver.ts`. It should issue ordinary commands, so a seat can switch between human, AI and (Phase 5) a remote player.

## Non-goals (for now)

- No deckbuilding marketplace, no online ranked ladder, no monetization — this is about a faithful, playable simulation of the paper game, not a live-service product.
- No attempt to reimplement every cycle on day one — breadth comes after Phase 1–2 prove the engine approach is right on a small, well-understood card pool.
