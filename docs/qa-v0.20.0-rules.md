# QA of v0.20.0 and the Red Skull fix (#131): rules and state side

Branch `feature/wave-10` at 009c0f18. No engine, script, data or client code was changed; only new test files and this
report. Run as `pnpm exec vitest run <file>` in each package.

## Test files added

| File                                                           | Pass | `it.fails` (bugs) |
| -------------------------------------------------------------- | ---- | ----------------- |
| `packages/client/src/view/undo.qa.test.ts`                     | 5    | 1                 |
| `packages/engine/src/payment-order.qa.test.ts`                 | 3    | 1                 |
| `packages/cards/src/wave2/trors/red-skull.qa.test.ts`          | 3    | 1                 |
| `packages/cards/src/qa-2026-10-13-covered-claims.qa.test.ts`   | 0    | 3                 |
| `packages/cards/src/campaigns/trors-sleeper-timing.qa.test.ts` | 5    | 0                 |

## Bugs

No blocker. Four should-fix, two minor.

### Should fix

1. **"Max 1 per scheme" is claimed as data but no data enforces it** (`it.fails` in `qa-2026-10-13-covered-claims.qa.test.ts`,
   "Under Surveillance (06031) 'Max 1 per scheme'"). RRG 1.8 "Max, Maximum" p. 28. A second Under Surveillance attaches to the
   same main scheme (+8 target threat instead of +4). The scripts mark the ref `coveredByEngineRule()` with the comment
   "Max 1 per scheme (data)", but `attachLimitFault` (`engine/src/rules.ts`) only reads `playRestrictions.maxPerHost` and
   these cards have none. Sweep test (second `it.fails`) lists every card printed "Max 1 per scheme/identity" without it:
   03032 Followed, 30018 Followed, 30019 Overwatch, 06031 Under Surveillance, 26034 Chance Encounter, 32150 Wrapped in
   Metal (the last has one copy, so unreachable). The wave1 cap comment even says Followed uses `maxPerHost`, but the
   data has no such field (data gap).
2. **04163 Zola's Algorithm is missing its printed acceleration icon** (`it.fails`, "Zola's Algorithm (04163) prints an
   acceleration icon"). See the 04163 answer below. The engine counts acceleration icons on cards in play that are not schemes
   (`rules.ts` ~1918), so in an expert campaign the card in play should add 1 threat each villain phase and does not.
3. **The "on top" tag is wrong for every event** (`payment-order.qa.test.ts`, `it.fails` "event play: the card the payment
   view tags 'on top' ... is the top card of the discard pile"). RRG 1.8 "Event" p. 18: the event is discarded after
   it resolves, so the event ends on top and the last-picked payment card is second (the passing test pins
   `[event, lastPicked, firstPicked]`). The client's `onTop` tag and hover note ("Picked last, so it ends up on top of
   your discard pile. Pepper Potts ... use it next") are true for supports/upgrades/abilities and false for events,
   which are the plays where Pepper Potts matters most. The numbering itself ("spent N") is correct everywhere I tested.
4. **Undo can re-roll a random outcome** (`undo.qa.test.ts`, `it.fails` "Undo is not offered after a move that discarded
   a card AT RANDOM"). `revealsHiddenInformation` (`view/back-out.ts`) is a denylist of draw/reveal/look/shuffle events
   plus deck-zone `cardMoved`. A random discard from hand is just `cardDiscardedFromHand` (hand to discard), so Undo is
   offered. Undo itself replays the log so the same move gives the same result (pinned, passes), but the player has now
   SEEN which card went, and playing a different card first changes the hand and so the seeded pick (pinned, passes:
   across "play card X first" variants the random discard hits more than one card). Net effect: undo, reorder, re-roll.
   Reproduced with Bulldozer's Helmet ("discard 1 card at random from your hand" as a cost); the same applies to every
   `discardRandomFromHand`/`{ random: n }` hand effect a player triggers (Adam Warlock's response, Magic Crowbar, Ball
   and Chain, Thunderball/Wrecker variants, Spider-Man's obligation).

### Minor

5. **The Sleeper Awakened stays in play forever at 0 threat if The Sleeper leaves play without being defeated**
   (`red-skull.qa.test.ts`, `it.fails` "... discarded once The Sleeper leaves play undefeated"). With The Sleeper
   removed from the game or discarded, a thwart to 0 correctly discards the scheme (passing tests), but a scheme already
   sitting at 0 threat (held by the first sentence) is never re-checked once the hold lapses, so it keeps feeding Red
   Skull's +1 ATK. Practically unreachable (nothing in the game removes The Sleeper short of defeat) but real.
6. **Friends and Family (27132, `sm`)** has two ability refs (`27132.friends-and-family-constant`, `...-action`)
   that are not in the registry: its printed cost increase and Alter-Ego Action do nothing. It is linked from no identity
   I could find (`down-to-earth.ts` says it is scripted "with its owning hero's kit", which does not exist), so it is probably
   unreachable. No test; `grep 27132 packages/cards/src` shows only the comment.

## What was verified and holds (passing tests)

Undo (#120): a played card with its payment and answers rewinds to a deep-equal `GameState`, `GameRecord` and trail
length; redo of the same move gives the identical state (no re-roll of the same move); the saved log is truncated, so a
resumed game shows the undone state, and a resumed session has an empty trail, so Undo offers nothing from before the
resume (safe default; the history does not survive a save, by design of `SessionStore`); Undo stops at End turn. By code
reading (`view/undo.ts`): only the active seat, not during a pending choice, stops at another seat's command anywhere in
the move (a window pass by another player blocks it too, conservative), stops at turn/step/round boundary events, mulligan
and setup choices are not "moves" so they cannot be undone. The undo uses the log rewind (not engine involvement), so
once-per-turn/round limits, lasting effects and `playedThisTurn` counters all come back with the state: they are state.
No ghost log lines: the record is rebuilt from the baseline on rewind.

Payment order (#122): engine discards a payment's hand cards in the listed order, last on top, for a play of a support
(existing test), an ability cost paid from hand, and a play mixing an in-play resource ability with hand cards (only the
hand cards are discarded, the source card stays in play). Event plays: see bug 3.

The Sleeper Awakened (#131): thwarting to 0 with The Sleeper in play keeps it (existing test); with The Sleeper removed
or discarded and 1 threat on it, thwarting discards it (new); two-player table: held at 0 threat while The Sleeper
stands (new). Defeat path: existing test.

#124: no `packages/engine`, `packages/cards` source or test file changed (diff touches `package.json` of root, client and
content, the lockfile, Cargo, docs). The seeded-game pins did not need changing.

## False "covered by an engine rule / data" claims (class from #131)

105 `coveredByEngineRule()` call sites (87 distinct refs). I read the card text against the claim for all of them and ran
tests where cheap. Found false:

- 06031 Under Surveillance, 26034 Chance Encounter (and 03032/30018 Followed, 30019 Overwatch with the same text, scripted
  differently): "Max 1 per scheme (data)" -- no data, shown by test (bug 1).
- Comment-only claims I could not prove or disprove cheaply (unverified, no false claim found): 01140 Ultron Drones
  ("facedown Drone defeated goes to owner's discard: engine rule for facedown cards"), 21139b Odin and 21180b Cosmo ("a
  double-sided card leaving play is removed: RRG Double-Sided Card p. 17", an engine rule that does exist per
  `docs/phase7-wave1.md` and `effects.ts`), 40081a Routed ("cards under here are not in play"), 21182b Black Swan and
  21180b Cosmo ("flip resolves controller to the first player"), 27102a/b ("players cannot win unless they escape" via
  scenario `winCondition: "cardAbility"`), 32150 Wrapped in Metal (its cannot-attack text IS scripted in `-constant-2`).
- The remaining refs are artifacts (empty duplicate `.obligation` refs, keyword reminders such as Incite, Uses, Victory,
  "Give to the X player", `-constant` refs beside real action refs) where the claim is true.
- Registry vs content: only 27132 has refs missing from the registry (bug 6). A heuristic scan of cards whose text has
  trigger words but no ability refs finds only keyword reminders (Guard, Patrol, Surge, Hinder, Incite, Toughness) and
  Crowd Control (01108, crisis icon reminder). I did not audit the `SKIPPED` maps.

## 04163 answer

The generator is right and the committed data is wrong. The scan `assets/card-art/bundles/cards/04163.png` shows the
acceleration icon in the text box, at the same place and shape as on 04141 Prison Camps (which has `icons:
["acceleration"]`); 04164 to 04166 show none. MarvelCDB's raw record has `scheme_acceleration: 1` for 04163 only, and
`schemeIconsField` reads obligations. Accept the generator's `schemeIcons: ["acceleration"]` and commit the regenerated
data (pinned by the `it.fails`).

## Randomness answer (The Sleeper Awakened "turns 3-4 in 18 of 20")

Not reproducible and not a seeding problem. The side-scheme deck at setup has 6 cards and the card's position is
uniform. Measured: the real campaign Red Skull node composed by the runner (`resolveBetweenGames` +
`startGameFromLog` + `createGame`), 150 campaign seeds: rounds 1..6 = 23, 22, 25, 27, 30, 23. Spread of 120 further
campaign seeds over 0..99999: 10, 18, 15, 25, 29, 23. Standalone 300 spread seeds: 59, 47, 49, 48, 43, 54; 300
consecutive seeds 0..299: 66, 39, 59, 52, 43, 41. Rounds 3 and 4 together are about one third, as they should be.
Seeding: `rollSeed()` is `Math.floor(Math.random() * 100000)` for new standalone games and for the campaign's own seed
(`scenes/campaign/roster.ts`), so a fresh profile does not repeat; in a campaign the in-game seed is drawn from the
campaign RNG and mixed with the attempt count (`mixWithAttempt`, `engine/src/campaign/runner.ts`), so a retry of a lost
node is a new shuffle unless the player picks "Same hands" (`replaySeed`). Caveats: only 100,000 distinct seeds; and
in played games the card can show EARLIER than position+1 (a second side scheme is revealed by other cards in some
rounds), never later. The reporter's streak (18 of 20 on 3-4) has a probability around 1e-7 under this distribution, so
I would ask for their game seeds (the Game Over screen shows the seed) before assuming a code problem.

## What I could not cover

- Undo in a multi-seat game, a campaign game, and another seat's response/interrupt in a response window: covered by code
  reading and the existing `undoOf` unit tests (another seat's command in the move blocks Undo), no real-engine test.
- Undo of a payment with a chosen X, an overpay-only resource, a helper (alliance) paying a cost part (the helper's
  hidden hand cards are used but Undo still allowed since no draw/reveal event is emitted: arguably fine, not tested), the
  `orderKeywords` choice, a held response.
- Other event types that look like they could reveal information but are not in the `revealsHiddenInformation` denylist
  (`cardFound`, `deckTopShown`, `encounterTopShown`, `hiddenPileRevealed`, `revealedInPlay`, `cardsRearranged`, `cardsSwapped`,
  `revealedCardDiscarded`). I found no hero-move path to them, and the accusation/hidden-pile reveal is a villain-phase
  When Revealed, so I did not file them.
- Payment ordering for alliance/"payable by any player" helpers (each to its own pile; `discardOrderOf` is per owner by
  code reading), a chosen X, and an overpay-only source; the view-model's numbers were not run against a real multi-seat
  game.
- 3 and 4 player Red Skull, and expert campaign for the Sleeper (the printed text does not vary).
- The client UI (hover note, update banner, crowded play area, Decks screens, defend text): the browser QA agent's side.
