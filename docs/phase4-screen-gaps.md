# Phase 4 follow-up: screens the design canvases draw that the client doesn't

Owner: `game-client-engineer`, with `game-rules-architect` for the engine queries in §2.

This is a subplan of PLAN.md Phase 4. It lists every screen in `Marvel Champions game screens/` that the client is missing or only partly implements, and breaks the work into independent workstreams (§3) that can be picked up one at a time. If you land or change a workstream, update this file in the same change, and tick its box in §3.

Inventory taken 2026-09-13 against `feature/phase7-8-9`.

## 0. Sources and ground rules

**Canvases** (all in `Marvel Champions game screens/`):
- `Screens - Desktop.dc.html`: sections 00 (flow map) to 14. Section numbers below (`D02`, `D13`…) refer to these.
- `Screens - Phone.dc.html`: `P01`–`P17`.
- `Screens - Tablet.dc.html`: `L01`, `L02`, `P01`, `P02`, `L05`–`L08`. Its portrait screens are also numbered `P01`/`P02`, so they are cited here as `T-P01`/`T-P02`.
- `Board - Long Table.dc.html`, `Board - Phone.dc.html`: the board.
- `Components.dc.html`: the design system.

**Ground rules, unchanged from Phase 4:**
- **Phaser is a view, never an authority.** Every rules fact on these screens (legality, damage, threat, deck legality) comes from `@mc/engine`. A screen that needs a fact the engine doesn't expose waits for an engine query (§2). It never computes the fact itself.
- **The mocks' card text is placeholder** (PLAN.md Phase 4, "Design source"). Names, stats and rules text come from `@mc/content`. See §5 for the mock content that is wrong for the Core Set.
- **Dashed = not yet real.** An action a screen shows before it exists is drawn unavailable with its reason, not omitted. Game Over already does this.
- **Hidden information stays hidden.** Previews and advice must use only what the deciding player may see (`view/visibility.ts`). A facedown boost card is a range, never a peeked value.
- **"Seat · AI" is "Seat · you"** (PLAN.md Phase 4, hero seats). Hero AI is Phase 8 backlog.
- New view models are plain TypeScript with Vitest tests, and scenes stay thin (PLAN.md Phase 4).

## 1. Inventory

Status: ✅ built · ⚠️ partial · ❌ missing · ⛔ out of scope.

| Canvas | Screen | Status | Today | Workstream |
|---|---|---|---|---|
| D01, P01 | Title | ⚠️ | `scenes/title.ts` is the title *and* all of setup on one page. | W2 |
| D02, P02 | Scenario select | ❌ | A row of villain thumbnails on Title. | W2 |
| D03, P03, T-P02 | Hero select ("Take your seats") | ❌ | A tile grid on Title, "Heroes — N seats, all played by you". | W2 |
| D04, P04 | Deck builder / Deck check | ⚠️ | `scenes/deck-builder.ts`: identity, aspect, name, text search, add/remove, live legality. No deck analysis. Not a step in the setup flow. | W1 |
| D05, P12 | Table setup | ❌ | Standard/Expert and a seed field on Title. | W2 |
| D06, P13, L05 | Setup deal & mulligan | ❌ | The mulligan is a generic pending choice in `scenes/choice.ts` over the board. | W3 |
| D07, Board canvases, L01, T-P01 | Board | ✅ | Long table and phone tabs. Small chrome gaps. | W8 |
| D08, P14 | Inspect | ✅ | `scenes/inspect.ts`. No per-game history. | W8 |
| D09, L06 | Targeting | ⚠️ | Target mode dims and highlights. The prompt is one line in the action bar. | W5 |
| D10, P15 | Pending choice: defend | ⚠️ | A generic option sheet with an authority label. | W6 |
| D11, P09, L02 | Villain phase | ✅ | `scenes/villain-phase.ts`: step strip and phase log. | W7 |
| D12, P10, P11, P17, L08 | Game over | ✅ | Wide and tall layouts, stats, turning points, seats, MVP, both rematches. | W8 |
| D13, P16, L07 | Pause & Rules | ❌ | Nothing. The board has no menu button. | W4 |
| — (P16, L07, D01) | Settings | ❌ | `settings.ts` holds `reducedMotion` and `textResolution`; no screen shows them. | W4 |
| D14 | Decks & Collection | ⚠️ | `scenes/decks.ts`: deck list, paste and MarvelCDB import, edit, delete. | W1, W9 |
| D01 | Campaign | ⛔ | Drawn locked in the mocks. Out of scope (PLAN.md Phase 4). | — |

`SCENES.setup` is already reserved in `scenes/keys.ts` with no scene behind it.

## 2. Shared prerequisites

These are needed by more than one workstream. Each is small enough to land on its own, ahead of the screens that use it.

- **S1. Deck stats view model** (`view/deck-stats.ts`, client). Resource/cost curve, average cost, counts by card type and by aspect/hero/basic, all from `@mc/content` card data. It's descriptive, not a rules query, so it belongs in the client. Used by W1 and W9.
- **S2. Setup draft state.** The choices that span several setup screens: scenario, difficulty, modular sets, seats (deck id per seat), first player, seed. Today they're private fields on `TitleScene`. Move them into one plain object that each setup scene reads and writes, and that serializes to the existing `SessionConfig`. Used by W2 and W3.
  - `SessionConfig` already carries `modularSetIds` and `firstPlayerIndex` (`engine/host.ts:33-37`, passed through in `engine/session-core.ts:111-112`), so this is UI plumbing, not engine work.
- **S3. Encounter deck preview** (client, calling `@mc/cards`). The deck a table setup would build, by set and by card type, plus the nemesis sets held back and the obligations shuffled in. `coreScenario()` already builds the encounter deck from the scenario, the modular sets, Standard (+ Expert) and each hero's identity sets (`packages/cards/src/core/setup.ts`), so a preview should call the same builder rather than re-deriving the list. Used by W2.
- **S4. Results history.** Win/loss record per scenario, best clear, and per-deck record and last played.
  - Mostly derivable already: `GameStorage.list()` returns every recorded game with `status` `won`/`lost`/`abandoned`/`incompatible`, its `config` and its `round`.
  - **Gap:** a custom-deck seat is saved as `{ identityCardId, deck, aspects }` (`view/deck-seat.ts`), with no deck id, so a per-deck record can't be attributed. A precon seat is attributable by `starterDeckId`. Adding a deck id to the seat config needs `multiplayer-netcode-engineer`'s eye, since `SessionConfig` is the save and future network shape.
  - Used by W2 (scenario record) and W9 (deck record).
- **S5. Outcome preview queries** (`game-rules-architect`, `@mc/engine`). Needed for W5 and W6.
  - For a pending target choice: each legal target's result ("14 HP → 9 HP", "defeated", damage lost to no Overkill, a Guard cleared). Probe the effect through the pure engine, the way `legalActions` probes commands, so no rule is restated.
  - For a defend choice: each option's damage as a range over the unrevealed boost, using only public information.
  - "Why not the others?": group each present-but-illegal target by the engine's reason. `legalActions` already returns blocked targets with reasons, so check whether that covers pending choices before adding anything.
- **S6. Player-facing keyword text.** `content/src/schema/keywords.ts` enumerates keywords but holds no definitions a player reads. The Pause screen's glossary needs short definitions, each tied to its RRG 1.8 page. Owner: `card-data-pipeline`. See §4 on wording.
- **S8. Searchable, scrollable roster.** Scenario select and Take your seats both list things that will grow far past a screenful. The pool already has 3 Core and 3 wave 1 scenarios and 12 precons before any saved or imported decks, and every later pack adds more. So neither roster may be a fixed grid that assumes it fits.
  - **The list:** build on the virtualized list the deck screens use (`ui/virtual-list.ts`, PLAN.md Phase 7, "scroll lists"). Rows scroll by pixels, only visible rows are live objects, and the scroll state lives in a plain-TS model that survives a scene rebuild.
  - **The search:** a text field above the list, with a plain-TS filter model and tests.
    - Heroes match on hero name, alter-ego name, deck name, aspect and source (precon, imported, built). Scenarios match on villain name, scenario name, product or pack, and encounter set name.
    - Filtering is case- and accent-insensitive.
    - When nothing matches, the list says so and offers Clear.
    - The query persists while the player moves between setup steps (S2), and resets on a new setup.
  - **Quick filters** are chips beside the search:
    - heroes: aspect, source, and "playable now" (hides seats blocked by the engine's reasons in `view/seats.ts`, without dropping them from the data);
    - scenarios: product or cycle.
  - **Keyboard, pad and touch:**
    - Every row is a logical focus stop, and focusing a row scrolls it into view.
    - Page Up/Down and Home/End move through the list, and typing while the list has focus jumps to the search field.
    - A dimmed (blocked) row still takes focus, so its reason can be read.
  - **Layout:** the search and the list share one layout function with the rest of the screen, and a test checks the list's viewport never overlaps the controls above or below it. Checked at portrait phone (about 440×900), 800×600 and desktop sizes.
  - Used by W2's Scenario select and Take your seats, and by W9's deck list.
  - **Partly landed (`game-client-engineer`, 2026-09-15), on today's Title rather than W2's own screens.** `ui/virtual-list.ts` (`McVirtualList`) is the pixel-scrolling virtualized list, with `view/list-scroll.ts` for scroll state, `view/drag-gesture.ts` for tap-vs-drag and momentum, and `view/roster-filter.ts` for the search. The Decks list and the deck builder's pool use the same widget.
    - **Done:** the list, the search field with an empty-result message and Clear, every row a focus stop with scroll-into-view, Page Up/Down and Home/End, and layout tests.
    - **Not done:** the quick-filter chips (aspect, source, playable-now, product/cycle). The filter model is shaped to take them without a rewrite.
    - **Seen working in the browser by the main session** at 800×600 and an emulated 375×812 phone: wheel, drag with a flick, and tapping a row; typing narrows both rosters; rows clip at the list edges.
- **S7. Log jump.** Replay a saved log up to command N into a read-only view, with the live game untouched. `replay()` exists (`packages/engine/src/engine.ts:171`). The work is a read-only board over a replayed state. It is also the basis for Game Over's "Watch the replay". Used by W4 and W8.

## 3. Workstreams

Each workstream lists its canvases, what's already there, the work, what it depends on, and when it's done. They are ordered by suggested priority (§6), but only the listed dependencies are hard.

### W1. Deck analysis

Canvases: P04 (Deck check), D04 (Deck builder), D14 (right-hand stats panel).

Already there: `scenes/deck-builder.ts`, `view/deck-builder-model.ts` (`legalityOf`, `browsablePool`). `PoolFilter` already supports `type`, `trait` and `maxCost`, but the scene wires only the text search.

- [ ] S1, the deck stats view model, with tests against the six Core precons.
- [ ] **Deck check screen** (P04). Resource curve with average, composition counts, tabs for Curve / Cards / Aspect, the deck list with quantities, "Edit deck", and "Start game ▸". Reached per seat from the setup flow (W2) and from the Decks screen.
- [ ] **Builder stats panel** (D04). Cost curve, legality chip ("41 CARDS · LEGAL") and the deck list grouped by Hero / aspect / Basic with a "+ N more" overflow.
- [ ] **Builder filters.** Type filter chips (All, Ally, Event, Upgrade, Support, Resource) wired to `PoolFilter.type`, plus the aspect switcher D04 shows.
- [ ] Builder "Preconstructed" (reset to this identity's precon) and "Clear" (back to the identity set only).
- [ ] Deck advice ("Light on thwart…"), **only after** §4's decision on advice.

Depends on: nothing hard. W2 is where Deck check sits in the setup flow.

Done when: every Core precon and a custom deck show a curve, composition and grouped list, in the builder and on Deck check, at desktop and phone sizes.

### W2. Title menu and the setup flow

Canvases: D01, P01 (Title); D02, P02 (Scenario); D03, P03, T-P02 (Seats); D05, P12 (Table setup).

This reverses the Phase 4 decision to fold Scenario → Heroes → Deck into one screen. That decision was made because precons were the only deck choice; Phase 9 decks have since landed.

Already there: all the setup decisions on `scenes/title.ts`, `view/seats.ts` (seat blocking with the engine's reasons), `view/deck-list-model.ts` (`deckOptionsOf`), `view/seed.ts`, `titleFocusOrder`.

- [ ] S2, the setup draft state.
- [ ] **Title as a menu** (D01). Continue card (scenario · difficulty · round · heroes, from the existing `continueLabel`), New game, Decks & Collection, Campaign (drawn locked), Settings (W4; drawn unavailable until then). Footer: card-pool coverage ("233 / 233 Core cards live", from the ability registry) and build version.
- [ ] **Scenario select** (D02). A searchable, scrollable roster (S8) of every scenario in the pool, not a fixed row of thumbnails. Each row is a card with villain art. Detail panel: main scheme, threat per player, villain HP per player per stage, encounter sets, a stage-by-stage row. Step indicator ("Step 1 of 4"), Back, "Choose heroes ▸". The record line waits on S4. Blurbs wait on §4.
- [ ] **Take your seats** (D03, P03, T-P02). Up to 4 seat slots, each with identity, aspect, HP and hand size, plus an empty-seat state ("Tap a hero for seat 4"). A searchable, scrollable roster (S8) of every precon, saved and imported deck, with THW/ATK/DEF. A blocked deck is dimmed in place with the engine's reason. The seat slots stay fixed above the roster while it scrolls. Hero detail panel: the identity's **obligation** and **nemesis set** (`HeroIdentityCard.obligationCardId`, `nemesisEncounterSetId`). "Use preconstructed for all seats". "Build decks ▸" / "Deck check ▸" into W1.
- [ ] S3, the encounter deck preview.
- [ ] **Table setup** (D05, P12).
  - Difficulty: Standard and Expert, from `Scenario.villainStages`.
  - Modular set picker: every Core modular, the scenario's recommended set preselected, the count from `Scenario.modularSetCount` when set. See §5 on "required · locked".
  - Seating and first player, sent as `firstPlayerIndex`, with a Random option that rolls from the seed so the game still replays.
  - "The encounter deck you're building" (S3) and "The game you'll get" (villain total HP, starting threat, deck size, obligations).
  - Seed with Reroll, and "Deal it out".
- [ ] Focus routes for every new screen, following `view/screen-focus.ts`.
- [ ] Retire the setup half of `scenes/title.ts` once the flow covers it. The fastest path must stay fast: New game → accept every default → a game in the same number of presses as today's "Start game", or close to it.

Depends on: S2, S3, S8. S4 for the record line. W1 for the Deck check step (the flow can link straight to Table setup until W1 lands).

Done when: a 1–4 seat game with a non-recommended modular set and a non-default first player starts from the new flow, and its save replays. Also, with at least 100 decks and 20 scenarios loaded (test fixtures are fine), both rosters must:
- scroll smoothly;
- find a deck or scenario by typing part of its name;
- be fully reachable by keyboard and pad;
- never overlap the controls above or below them, at phone, 800×600 and desktop sizes.

### W3. Setup deal and mulligan

Canvases: D06, P13, L05.

Already there: the engine's `mulligan` step and its pending choice, and the generic sheet in `scenes/choice.ts`.

- [ ] A dedicated setup scene shown before round 1, driven by the engine's setup steps and events (not a scripted sequence): villain and main scheme placed, starting threat, setup cards revealed, obligations shuffled in, opening hands.
- [ ] The opening hand as full cards with per-card mulligan toggles, and "Mulligan N" / "Keep all". It answers the same `PendingChoice` the generic sheet answers today, so the command log is unchanged.
- [ ] Other seats' status (kept, still deciding). Since one human plays every seat, the screen steps through seats in the engine's order. The tablet layout (L05) shows all seats at once.
- [ ] The revealed setup card panel and a setup log, reusing `view/log-lines.ts` wording.
- [ ] "Why this matters" hint (P13), **only after** §4's decision on advice.

Depends on: nothing hard. Reads better after W2.

Done when: a 4-seat game's mulligans all go through this screen, and the saved log is identical to the same choices made through the generic sheet.

### W4. Pause & Rules, and Settings

Canvases: D13, P16, L07.

- [ ] The menu button on the board chrome (long table "MENU", phone "≡"), and Escape when no mode or overlay is open.
- [ ] Pause overlay: status line (scenario · difficulty · round · phase · seat), Resume, Save & quit (saves are continuous, so this is "back to title"), Concede.
  - **Concede has no engine path.** The saves have an `abandoned` status, but the engine has no conceded outcome. Decide with `game-rules-architect` whether conceding is a client-only status change or an engine outcome that Game Over can show.
- [ ] Rules reference filtered to the keywords and statuses on the table, with search (needs S6). Also: villain phase order, and the scenario's card list.
- [ ] "Jump to a moment" into the log (needs S7).
- [ ] **Settings** screen, reachable from Pause and from Title: reduced motion (exists), large card text, sound (once audio exists, Phase 8). Table options (auto-resolve villain phase, rules hints) wait on §4.
- [ ] Pass-and-play handoff, **only after** §4's decision.

Depends on: S6 for the glossary, S7 for log jump. Pause, Resume, Save & quit and Settings can land first.

Done when: every screen that shows a board can pause, read a rule for a keyword on the table, change a setting, and return to the same state.

### W5. Targeting

Canvases: D09, L06.

Already there: target-select mode in `scenes/board/controller.ts`, dimming, `view/highlights.ts` (blocked targets with the engine's reasons), and the action bar's prompt line.

- [ ] A targeting panel: title and source ("Photon Blast — deal 5 damage to an enemy"), Cancel · Esc, the legal target list with each target's outcome (S5), and the hovered target's confirm line.
- [ ] "Why not the others?", grouped by the engine's reason.
- [ ] The tablet inspector rail (L06), which shows the source card beside the target list.

Depends on: S5 for outcomes. The panel and "why not" can land first with names only.

### W6. Pending choice: defend

Canvases: D10, P15.

Already there: `scenes/choice.ts`, `PendingChoice.authority`, and `decisionLabel` from `view/villain-walkthrough.ts` (which carries the Peril note).

- [ ] Incoming attack summary: attacker, base damage, number of facedown boost cards, and any forced interrupt that changed it.
- [ ] Option cards with consequences: who exhausts, damage range (S5), whether an ally survives. Defense events playable now are listed with cost and resources available.
- [ ] The stack, with the open window marked ("← here").
- [ ] "Waiting on": who decides, and the Peril note.
- [ ] "Auto-defend next time this is the only option" and the phone countdown, **only after** §4's decision on auto-resolve.

Depends on: S5 for ranges. The summary, stack and "waiting on" can land first. The stack needs a readable view of the engine's stack frames; ask `game-rules-architect` whether `GameState` already exposes enough.

### W7. Villain phase

Canvases: D11, P09, L02.

Already there: the step strip, the phase log, auto-advance, and pausing on choices.

- [ ] "Happening now" breakdown for an activation: base + boost − defense = damage (or scheme + boost = threat), with the boost cards shown face up once flipped. Every number comes from the engine's events.
- [ ] "Queued this phase": each seat's pending activations, in the engine's order.
- [ ] The main scheme threat callout ("11 / 12 threat — one more and the scenario is lost").
- [ ] The inline interrupt window (P09, L02): when the player has a legal interrupt, show that card with its play button in the walkthrough, alongside "Let it resolve". It dispatches the same answer the choice overlay would.
- [ ] Tablet (L02): keep the team rail legible behind the walkthrough.

Depends on: nothing hard. The breakdown may need event fields the engine doesn't emit yet; check `view/villain-walkthrough.ts` before asking for any.

### W8. Board, Inspect and Game Over follow-ups

Smaller gaps in screens that are otherwise built. Each item stands alone.

- [ ] Board: "Legal now: 3 plays · 2 abilities" and "Why illegal?" under the log (Board - Long Table). `legalActions` and `view/highlights.ts` already have the data; nothing draws the summary.
- [ ] Board: the menu button (lands with W4).
- [ ] Board: Team tab "Table talk" hint (P08), **only after** §4's decision on advice.
- [ ] Board: tablet landscape side rail for Team + Log (L01). PLAN.md Phase 4 routes tablet landscape to the long table; revisit that call rather than overriding it here.
- [ ] Inspect: "This card, this game": where the card has been, from the game log (D08, P14, L06).
- [ ] Game Over: "Watch the replay" (needs S7), "Export log", "Share result", "Next: <scenario> ▸", a per-seat damage/thwart table (L08), and phone "Tune deck" / "Read log" (P11).

### W9. Decks & Collection layout

Canvas: D14. This overlaps PLAN.md Phase 9 and should be checked off there as well.

Already there: `scenes/decks.ts`, `view/deck-list-model.ts`, `view/deck-status.ts`, `view/deck-import-model.ts`.

- [ ] Two-pane layout on wide screens: deck list beside the card pool and the selected deck's stats (S1).
- [ ] The deck list uses S8's search and quick filters (aspect, source, legal/blocked).
- [ ] Per-deck record and last played (needs S4, including its deck-id gap).
- [ ] "Recently changed" (needs a deck revision history in deck storage).
- [ ] Duplicate, Export (decklist text, the inverse of paste import), and "Play this deck ▸" (opens W2's Seats with this deck in seat 1).
- [ ] Deck note, **only after** §4's decision on advice.
- [ ] Owned-card tracking ("226 of 226 cards owned"), **only after** §4's decision.

Depends on: S1, S4.

## 4. Decisions to settle

- **Advice text.** Deck notes (D14, P04), "Why this matters" (P13) and "Table talk" (P08) are strategy advice, not rules. If kept, each needs a named heuristic in a tested view model, worded as a suggestion, and never using hidden information. Or drop them.
- **Scenario and hero blurbs** (D02, D03, P03). They aren't in `@mc/content`. Either write short original descriptions, or show only data (stages, HP, sets, obligation, nemesis). Don't copy FFG card or product text into them.
- **Keyword glossary wording** (S6). Short paraphrases with an RRG 1.8 page cite, rather than transcribing the RRG.
- **Auto-resolve and auto-defend** (P12, D10, P15). A client preference that answers a choice for the player is still the player's command. It must issue ordinary commands and never change engine behavior. Decide whether it's in scope before Phase 5 makes seats remote.
- **Heroic difficulty** (D05). Not a Core Set mode and not in the engine. Leave it out, or draw it unavailable.
- **Concede** (W4): a client status or an engine outcome.
- **Pass-and-play handoff** (P16, L07). Only meaningful with several humans on one device, which means hiding hands between seats. Decide whether that's Phase 4 or Phase 5.
- **Owned-card collection** (D14). With only Core implemented every card is "owned". Probably out of scope until Phase 7 adds packs someone might not own.
- **Seed display** (D05 shows `4F2C-91A7`). Today seeds are whole numbers typed and shown as digits (`view/seed.ts`). A hex display needs a lossless round trip with what the player types back in.

## 5. Mock content that is wrong for the Core Set

Build these from `@mc/content`, not from the canvases:

- **Heroes.** Ms. Marvel, Thor, Black Widow and Captain America are not Core heroes. The D03 roster says "5 identities" but omits Iron Man, who is one.
- **Difficulty.** P02's "STD I / STD II / EXPERT" is not a Core mode. Core has Standard and Expert (`Scenario.villainStages`).
- **Modular sets.**
  - D05 lists "Ultron Drones" as a modular set. The Core modulars are Bomb Scare, Masters of Evil, Under Attack, Legions of Hydra and The Doomsday Chair.
  - D05 and P12 mark Masters of Evil "required by Klaw · locked". The data models each Core scenario's modular as *recommended* (`recommendedModularSetIds`: Rhino → Bomb Scare, Klaw → Masters of Evil, Ultron → Under Attack). Confirm against the RRG before locking any modular in the picker.
- **Stats and text already flagged in PLAN.md Phase 4:** Sonic Boom's text, Klaw's "SCH 14", Defense Network's "+1 DEF".

## 6. Suggested order

1. **W1**, starting with S1. Small, unblocks the analysis in two places, and needs no engine work.
2. **W2**, with S2, S3 and S8. S8 can land first, on today's Title seats and scenario row, since the pool has already outgrown them. The largest visible gap, and it gives W1's Deck check its place in the flow.
3. **W3**. Self-contained once W2's flow exists.
4. **W4**, starting with Pause, Resume, Save & quit and Settings. The glossary follows S6, and log jump follows S7.
5. **S5**, then **W5** and **W6**. Blocked on engine queries, so start the `game-rules-architect` design early and build the parts that don't need it.
6. **W7**, **W8** and **W9** as independent follow-ups.
