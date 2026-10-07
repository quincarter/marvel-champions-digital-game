# Wave 7 QA: deck builder, built the way a player builds

Specs: `packages/client/e2e/wave7-deck-builder-pool.spec.ts` (flows 1, 2, 3, 7, 8), `wave7-deck-builder-rules.spec.ts`
(flows 4, 5, 6), driver `wave7-deck-builder-helpers.ts` (pointer, wheel and keyboard only; reads focus-route rects, visible
text, the Decks debug rows and the clipboard). Run: `E2E_PORT=5341 pnpm exec playwright test e2e/wave7-deck-builder-*.spec.ts
--project=desktop --workers=1`; `MC_QA_PHONE=1` reruns the same flows at 390 x 844 touch. Result: 11 passing, 8 `test.fixme`.
Screenshots: `/private/tmp/claude-501/-Users-quincarter-Documents-Dev-marvel-champions-game/144e988e-5813-49ba-b244-097ac3ae5667/scratchpad/deck-builder/`
(`<name>-1440.png`, `-390.png`). No finding blocks play. Expected behavior is `validateDeck` (custom-decks.test.ts), RRG 1.8 p. 50.

## Per flow

1. **Deadpool 'Pool (pass).** Opens on "IDENTITY — DEADPOOL", "HERO · 15"; 'Pool cards appear only after the aspect is chosen
   (193 cards, 156 before); name search, Ally filter, pack stepper work. Second Break Time: "Break Time has 2 copies, but its deck
   limit is 1: no more than 1 copy may be in a deck." Fourth Barely a Scratch: "...has 4 copies; a deck may include no more than
   3 copies of a non-unique card (by title)." The + is never refused; the legality panel flags it. Legal reads "Legal — 40 cards."
   Saved deck: legal, 40, same cards and aspect on reopen (`1-legal`, `1-decks`).
2. **Spider-Man 'Pool (pass).** 'POOL offered; after choosing it 190 cards incl. Break Time; 40-card deck legal and saved.
3. **Deadpool + Aggression (pass, one finding).** 'Pool cards hidden (44017, 44013 absent). A deck already holding them reads, per
   card, the validator's text: "Barely a Scratch is a 'Pool card, but this deck's aspect is Aggression; beyond its identity set a
   deck may only use its chosen aspect and basic cards." The picker replaces rather than adds, so "two aspects" cannot be built.
   No UI/validator disagreement. Finding F4.
4. **Illegal states (pass).** Identity card removed: `"Yoo-Hoo!" has 1 copy, but Deadpool (Wade Wilson)'s identity set has exactly 2
copies, and a deck must include exactly that many.`; Montage 0: "Montage is missing: a deck for Deadpool (Wade Wilson) must include
   every card in that identity's set, and this one needs 1 copy." 39 and 51 cards: "The deck has N cards; a deck must have between
   40 and 50 (the identity and permanent cards do not count)." Not findable at all (search shows "No cards match this filter."):
   other heroes' kits, NeXt Evolution campaign cards, the Dreadpool set. Linked Specialist: findable (F2), then "Combat Specialist
   has the Linked keyword: linked cards cannot be included in a deck; they are set aside at setup by the card that brings them into play."
5. **Special starts.** Psylocke: "HERO · 17", Psi-Knife row text starts "Permanent."; the validator does not count them (41 listed
   reads "The deck has 39 cards"), F3. Angel: "IDENTITY — ANGEL", 15-card set (the builder shows no identity art, so the three
   faces are not visible here). X-23: "HERO · 16", X-23's Claws "Permanent.", Specialized Training offered and legal. Domino: no
   off-aspect allowance. Cable: set holds Technovirus Purge, off-aspect side schemes not offered (F1).
6. **Collection (pass, one gap).** Name, pack ("DEADPOOL" after "<"), wave and sort steppers work; 'Pool chip pink "'POOL"; tapping a
   row's text opens Inspect, which reads "3 PER PLAYER" for Break Time (`6-inspect-break-time`). No trait or cost search (F5).
7. **Export / import (pass).** Export copies "Hero: Deadpool\nAspect: Pool\n3x \"I Got This\" ..." (40 copies); delete; Paste: "Imported
   "Deadpool (imported)"." legal, 40; re-export is byte-identical (`7-roundtrip`). Name is not carried (see Other).
8. **Seat it (pass).** Title > New game > Rhino > Seats > "Deadpool" > Set the table: ADDED SET "Dreadpool · 'Pool deck · 6 set aside",
   encounter composition lists Dreadpool 1; Deal it out reaches round 1 (`8-setup`, `8-board-round-1`).

## Findings (worst first)

Status after the fix pass (2026-10-06): all eight fixed, their `test.fixme` now plain tests; pool filtering now asks the engine's
`cardOfferedToDeck` (a small export beside `cardLegalForIdentity` in `packages/engine/src/deck.ts`; `validateDeck` uses the same two
off-aspect predicates), so the client holds no copy of the aspect rule. View-model tests: `packages/client/src/view/deck-builder-fixes.test.ts`.

- **F1 fixed:** Cable's off-aspect player side schemes are offered and say "Cable: any aspect" on the row (`view/deck-builder-model.ts` `browsablePool`, `poolRowNote`).
- **F2 fixed:** Linked, separate-deck, campaign, scenario and other heroes' Team-Up cards are no longer browsable (same engine rule).
- **F3 fixed:** counts read the validator's size: "Legal — 40 cards + 2 permanent." in the builder, Decks rows and headers, Deck check (`view/deck-stats.ts` `countedCards`, `deckCountText`).
- **F4 fixed:** a card the deck holds stays in the pool list when refused ("not allowed in this deck" on the row), and "Your deck" now lists every line (no "+ N more"), each with a "-"; it scrolls in the wide rail (`scenes/deck-builder.ts`, `ui/deck-stats-widgets.ts`).
- **F5 fixed:** the text search also matches traits and type, name matches first; placeholder reads "name, trait or type".
- **F6 fixed:** "event · 3 per player" (`poolTypeLine`, via `view/per-player-cost.ts`).
- **F7 fixed:** a saved deck's Decks row and stats header name its aspect(s) (`view/deck-title.ts`).
- **F8 fixed:** `aspectName` in `view/aspect-stamp.ts` is the one source ("'Pool"); the precon row, Seats, Inspect, board, briefing, table setup and campaign labels use it.

## Other (not pinned)

Fixed: the pack / wave / sort steppers are in the keyboard focus route (`view/screen-focus.ts`); Back after Save opens Decks on the
saved deck. Left: Save works on an illegal deck (Decks marks it Illegal); Delete has no confirmation; Export omits the deck name.

## Phone (390)

Passing at 390: flows 2, 3, 4, 5 (every passing test in those groups). Flow 1 reaches "Legal — 40 cards." at 390, but its Save did not
register in two runs (flow 2's Save did), so Save, reopen, 7 and 8 are unverified there, not called defects; flow 6's pack stepper
tap did not change the label in the driver, also unverified. The phone builder scrolls its top region above a fixed search field and pool list.
