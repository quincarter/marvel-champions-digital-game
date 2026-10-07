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

- **F1 rough, high: Cable's off-aspect player side schemes cannot be added.** Under Leadership, "Lock and Load" (40019), "Establish
  Perimeter", "Live Dangerously" return no rows though `offAspectAllowance` makes them legal (custom-decks.test.ts); no Player Side
  Scheme type chip either. Owner `packages/client/src/view/deck-builder-model.ts` (`browsablePool`). fixme "Cable can add...".
- **F2 rough: X-23's four Linked Specialists (43034-43037) are findable and addable**, unlike campaign, separate-deck and
  Dreadpool cards, which the list hides; only the panel then refuses them. Same owner. fixme "a Linked Specialist is not findable".
- **F3 wrong information: Psylocke's precon reads "Legal — 42 cards."** while the validator counts 40 (Permanent Psi-Knives, RRG p. 32)
  and a short deck says "39 cards" for 41 listed; "Your deck" shows "Psi-Knife 2" with no Permanent mark. Owner
  `scenes/deck-builder.ts` `#drawLegalityLine` (campaign mode already splits "N cards + M pinned"). fixme.
- **F4 rough: after an aspect switch the refused cards leave the pool list**, so they cannot be removed one by one (only Clear, or
  switching back); campaign mode keeps such lines listed. Same file as F1. fixme "can still be found and removed".
- **F5 rough: no trait search.** "Soldier" and "S.H.I.E.L.D." find nothing (name substring only; `PoolFilter.trait`/`maxCost` exist
  but no control sets them); the trait split itself is right in data (War Machine 01030 S.H.I.E.L.D. + SOLDIER, Agent 13 27046
  S.H.I.E.L.D. + SPY). Owner `scenes/deck-builder.ts` `#drawFilterInput`. fixme.
- **F6 wrong information: per player cost reads "event · cost 3"** on Break Time's row (Inspect says 3 per player). Owner
  `scenes/deck-builder.ts` `#renderCardRow`. fixme.
- **F7 wrong information: a user-built deck's row never names its aspect** ("Deadpool · 40 cards · legal", header "40 CARDS · MINIMUM 40
  · LEGAL · BUILT"). Owner `scenes/decks.ts`. fixme.
- **F8 rough: the aspect is spelled "POOL", not "'POOL"** on the precon row "DEADPOOL / POOL" (`view/deck-title.ts` `titleCase`), the Seats
  chip "POOL" and Inspect "EVENT · POOL". fixme.

## Other (not pinned)

Save works on an illegal deck (Decks marks it Illegal); Delete has no confirmation; Export omits the deck name; "Your deck" lists
10 lines then "+ N more"; Pack/Wave/Sort steppers are not in the focus route (`view/screen-focus.ts` `deckBuilderFocusOrder`), so
keyboard and pad cannot reach them; after Save the Decks screen does not select the new deck.

## Phone (390)

Passing at 390: flows 2, 3, 4, 5 (every passing test in those groups). Flow 1 reaches "Legal — 40 cards." at 390, but its Save did not
register in two runs (flow 2's Save did), so Save, reopen, 7 and 8 are unverified there, not called defects; flow 6's pack stepper
tap did not change the label in the driver, also unverified. The phone builder scrolls its top region above a fixed search field and pool list.
