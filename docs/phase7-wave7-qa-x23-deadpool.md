# Phase 7 wave 7 rules-QA pass: X-23 and Deadpool (`x23` 43001-43040, `deadpool` 44001-44058)

`rules-qa-engineer`, 2026-10-05. Scope: both hero packs (identity, events, supports, upgrades and allies, obligation and
nemesis sets, each pack's aspect and basic cards including the 'Pool aspect, and Deadpool's Dreadpool encounter set)
against RRG 1.8 and the post-1.7 rulings. Test file: `packages/cards/src/wave7/x23/qa-x23-deadpool.qa.test.ts` (85 tests, 4
of them `it.fails` pins, about 25 s). No non-test code was touched.

## 1. Sources found

Searches: `mc_rulesreference_v18_compressed.md` (page numbers are the table-of-contents numbers) and
`marvel-champions-rulings-post-rrg-1-7.md` for X-23, Deadpool, Dreadpool, Honey Badger, Laura, Wade and every card title of
both kits. **One ruling names a card of this slice**: June 2, 2026 - Ruling 5 (Exhausting Personality may exhaust any
player's identity), already scripted and tested (`deadpool/events.test.ts`). The rest is general:

| Source                                                                                    | Used for                                                                                                                            | Where pinned                                       | Result     |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------- |
| RRG "Labeled Ability" (p. 26), "Stun, Stunned" (p. 41), ruling August 13, 2026 - Ruling 1 | Stunned or confused hero using Maximum Effort, "Yoo-Hoo!", Katana, Cutupper, 'Pool Inspection, Bazooka                              | "Stunned and confused Deadpool ..." (7 tests)      | Pass       |
| RRG "Stun, Stunned" (p. 41): a replaced attack is "not considered to have attacked"       | A stunned X-23's basic attack offers no Critical Hit                                                                                | "X-23 stunned: responses ..."                      | Pass       |
| FAQ "Focused Rage (#27)" (RRG 1.8 p. 57), RRG "Cost" (p. 14)                              | A cost a tough status card would prevent cannot be paid: Maximum Effort at tough (Negasonic's 2 dealt damage is paid, F4 withdrawn) | "damage he chooses ...", "Negasonic"               | Pass / Bug |
| RRG "Damage" (p. 14): tough is discarded instead of the damage                            | Regeneration and This Card is Fire at tough; Metacidal Tendencies against a Toughness ally                                          | "The Regeneratin' Degenerate ...", "Metacidal ..." | Pass       |
| RRG "Swap" (p. 42)                                                                        | Armed to the Teeth, same-title swap (neither card enters or leaves play, state carried)                                             | "Armed to the Teeth ..."                           | Pass       |
| RRG "Team-Up" (p. 43), "Identity" (p. 23)                                                 | Frenemies needs both named friendly characters in play; a hero title names only the faceup side                                     | "Frenemies (44031) ..."                            | Pass       |
| RRG "Ownership and Control" (p. 31), "Player Side Scheme" (p. 34)                         | Dreadful Deeds counts a player who controls a pink card; Live Dangerously is a pink card its owner controls                         | "Dreadpool cards revealed ..."                     | **Bug** F2 |
| RRG "Action" (p. 4)                                                                       | Regenerative Longevity prints a plain Action                                                                                        | "X-23: Regenerative Longevity ..."                 | **Bug** F3 |
| RRG "Player Side Scheme Limit" (p. 34), spec Q1 = A, "Per Hero"                           | Keep Them Busy at three and four players; the limit of two at three players                                                         | "Player side schemes at three and four players"    | Pass       |
| Spec 4.1 Q44, Q45, Q46 = B, Q48, Q52 = B and the Merc ruling of 2026-10-05                | Dreadpool set once for any number of 'Pool seats; regeneration; chosen damage; Git Gud cost; Laser Swords; the Merc                 | several                                            | Pass       |

Owner rulings were applied as written and not re-opened.

## 2. Card-by-card audit against the printed text

Compared the 98 card records of both packs (printed text, timing word, label, cost, resource and scheme icons, traits,
keywords, play restrictions, deck limits, Restricted weight, Linked) with each script. Everything agrees except:

- **Regenerative Longevity 43006**: printed "Action:", scripted `heroAction` (finding F3).
- **Dreadful Deeds 44039**: the query leaves player side schemes out (finding F2).
- **Mulligan 44048**: "Discard your hand" is scripted as a discard of `handSizeOf()` cards (finding F5).

Judgments recorded rather than raised:

- Montage 44007 prints no "Max 1 per deck" line but the data has `deckLimit: 1` (a curation choice, no behavior difference
  in the precon).
- The Merc with the Mouth, Butler, Involuntary Procedures, Tabula Rasa 16 and Mutated Soldier agree with the text and the
  Q12, Q50 and 2026-10-05 owner decisions.
- Kidpool's, Cable's and Dogpool's trait and keyword lines agree with the data.
- Not checked against card scans (none in the repo): the audit is against the ingested printed text.

## 3. What was exercised beyond the precon games

All in the one file, grouped:

- **Regeneration.** Tough status absorbing the owed damage (no regeneration, no token) and the control without tough;
  a villain attack far past his hit points; with Endurance (12 hit points: the dial ends at 11 damage); Wade Wilson
  regenerated to 1 hit point and then eliminated by This Card is Fire's owed damage; two copies in hand owe 2.
- **Chosen damage.** Range 0 to 1 at one hit point left (taking 1 regenerates him and the event still deals 1); taking all 9
  deals 9 though the dial ends at 8; with a tough status card the range collapses to 0 and nothing is asked;
  "Yoo-Hoo!" takes 3 and removes 3.
- **Stunned and confused.** Maximum Effort, Katana, Cutupper, Bazooka (stunned), "Yoo-Hoo!" and 'Pool Inspection (confused):
  costs paid, effect canceled whole, status removed; Cutupper with a confused hero is not canceled; Barely a Scratch
  (a defense label) works with both statuses and leaves them.
- **X-23.** Living Weapon once per phase (used in her turn, offered again for the villain's attack); Honey Badger's response
  not offered when her tough status card prevents the consequential damage; a stunned X-23's replaced basic attack offers
  no Critical Hit (control offers it); Specialized Training at four players (four different Specialists, in player
  order from a first player in seat 3); Self-Isolation holding Honey Badger facedown: Sisterhood finds nothing, Laura Kinney's
  Action is refused, and after the basic recovery Honey Badger is shuffled back and a card drawn.
- **Dreadpool set.** One Crisis and six set-aside cards with two 'Pool seats, with three seats (one 'Pool), with four seats
  (two 'Pool) and none with no 'Pool seat; Crisis revealed to the third seat and to a fourth seat with the first player
  token on seat 2 (Dreadpool engages the first player in both); Dreadful Deeds per player (two 'Pool players and a third
  seat: 4 added threat; one of three: 2; Katana is not a 'Pool card: 0); Metacidal Tendencies against a Toughness ally put in
  play for real (the 2 damage is prevented, the tough card goes, a token is placed).
- **The Merc, three players.** Plot Convenience (the Merc player's card) and X-23's own Boom Boom are refused for both other
  seats during his turn and allowed without the Merc, on another seat's turn, and for his own player.
- **Armed to the Teeth and Git Gud.** Same-title swap of two Bazookas (event `sameTitle`, the exhausted state kept); Laser
  Swords (weight 2) swapped in over a Bazooka beside a Katana overfills the restricted limit and the Katana is discarded;
  Git Gud costs 0 without the fact and 2 with it, per seat.
- **Frenemies.** Cable seated as a player in hero form (played, 1 damage each, 3 + 3 from two different schemes); Cable
  seated in alter-ego form, no Cable, and Deadpool in alter-ego form: refused.
- **Negasonic and Mulligan.** See F4 (withdrawn) and F5.
- **Player side schemes.** Keep Them Busy at 3 and 4 players (9 / 12 starting threat, 15 / 20 removed); the limit of two at
  three players (a third played, one discarded, not defeated).
- **Every obligation, nemesis and Dreadpool card (24 reveals, each with the first and the last option at every prompt).**
  X-23's six, Deadpool's five and the six Dreadpool cards to each seat, revealed in a two-player game (X-23 + Deadpool)
  through the end of the villain phase: nothing left pending, the card left the deck, no card in two zones or in none, the
  restricted limit holds.
- **Expert games (3 groups, 11 games).** X-23 against Juggernaut (4 seeds), Deadpool against Stryfe (4), X-23 + Deadpool
  against Mister Sinister (3). Every state is checked (no prompt without an answer, no card in two zones or in none,
  rounds advance by one, no stall between steps, restricted limit) and every log replays to a deep-equal final state. The
  driver loses most expert games within two rounds, so each group requires that the best seed passes round 2. Hope
  Summers is never declared a defender (a driver policy). Typed prompts the driver does not know (a number, the Merc's
  question, Break Time's minutes) are answered by the test.

## 4. Findings

| ID     | Card(s)                                                     | What is wrong                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Rule                                                                             | Severity | Owner                                                   | Pinned test                                                                                    |
| ------ | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| F2     | Dreadful Deeds 44039                                        | "2 threat for each player who controls 1 or more 'Pool (pink) cards" ignores a pink player side scheme: a player whose only pink card in play is Live Dangerously 44024 adds nothing (`CONTROLS_POOL_CARD` queries ally, upgrade, support only).                                                                                                                                                                                                                                                                                                                                                                                                                                             | RRG "Ownership and Control" (p. 31), "Player Side Scheme" (p. 34)                | Low      | `ability-scripting-engineer` (`deadpool/dreadpool.ts`)  | `a player whose only 'Pool card in play is the player side scheme Live Dangerously counts ...` |
| F3     | Regenerative Longevity 43006                                | Printed "Action:", scripted `heroAction`, so Laura Kinney in alter-ego form is refused (`wrong_form`). The module test `x23/events.test.ts` "is an Action: refused in alter-ego form" pins the wrong behavior and must flip with the fix.                                                                                                                                                                                                                                                                                                                                                                                                                                                    | RRG "Action" (p. 4); Sisterhood 43008 (a plain Action) is playable in both forms | Medium   | `ability-scripting-engineer` (`x23/events.ts`)          | `Laura Kinney (alter-ego form) can play it: 4 damage is healed from her identity`              |
| ~~F4~~ | **Withdrawn (2026-10-06).** Negasonic Teenage Warhead 44044 | ~~Cost "deal 2 damage to Negasonic Teenage Warhead" with a tough status card on her: the Interrupt is offered, the tough card is discarded as if it were the cost, no damage is taken, and the treachery's When Revealed is canceled. The cost cannot be paid.~~ Withdrawn: the engine is right. The cost is dealt damage, not taken damage. RRG 1.8 "Cost" (p. 14): "If dealing damage is a cost, that cost is considered paid even if some or all of that damage is prevented"; FFG ruling "June 25, 2026 - Ruling 6": damage dealt as a cost can be reduced or prevented and the cost remains paid. The Focused Rage FAQ (#27, p. 57) is about a "take 1 damage" cost and does not apply. | ~~FAQ "Focused Rage (#27)"~~; RRG "Cost" (p. 14), ruling June 25, 2026 Ruling 6  | None     | None (engine owner checked)                             | `with a tough status card the cost is still paid: ...` now a passing `it`                      |
| F5     | Mulligan 44048                                              | "Discard your hand" is scripted as `discardFromHand(handSizeOf())`: a hand larger than the hand size (11 cards, hand size 5) discards only as many as the hand size and keeps the rest, then draws up to the hand size.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Printed text; RRG "Hand Size"                                                    | Low      | `ability-scripting-engineer` (`deadpool/pack-cards.ts`) | `Mulligan discards the WHOLE hand even when it holds more cards than the hand size ...`        |

F1 of the Cable and Domino pass (damaging abilities offer an enemy that cannot take damage) was excluded as instructed;
Deadpool's Katana, Cutupper, Bazooka, Maximum Effort and Da Bomb are all in the group it affects.

Notes that are not findings:

- Maximum Effort chosen from alter-ego form after a regeneration resolves its attack against an enemy with Retaliate
  (Whiplash): Wade at 1 hit point takes the Retaliate damage and is eliminated. That is the printed rules, not a defect.
- Honey Badger and Living Weapon: `taken: true` is correct for a tough status card, as the new test shows.

## 5. Questions for the owner

1. **Dreadful Deeds and a pink player side scheme (F2).** Does a player controlling Live Dangerously 44024 count as "a
   player who controls 1 or more 'Pool (pink) cards"? (A) Yes, any pink card in play under the player's control counts, the
   player side scheme included (recommended: RRG "Ownership and Control", p. 31, gives the card to its owner). (B) No, only
   allies, upgrades and supports (the current script).
2. **Regenerative Longevity (F3).** Confirm the printed word is "Action" (the data and `docs/cards_reference.md` say so).
   (A) Plain Action, playable in both forms (recommended). (B) The card is meant as a Hero Action and the data is a
   MarvelCDB error; correct the data instead.

## 6. What was not covered

- **Predictable Ploy / Negasonic against a Surge treachery.** The Juggernaut, Morlock Siege and Stryfe decks hold no
  treachery with Surge, and the Surge cards (Kree Manipulator 01178, Heart-Shaped Herb 01158) are in sets no scenario of
  this box deals. "Cancel its When Revealed effects" leaving the keyword in place is untested for these cards.
- **Break Time 44046 and the Merc's question with a real client prompt.** Both are answered by the test; the real prompt
  belongs to `game-client-engineer`.
- **Plot Convenience, Blackout, Tic-Tac-Toe, Rock Paper Scissors, War, Deadpool Corps Ship, Get in Front of Me!,
  Not my Responsibility, Headpool, Lady Deadpool's ELITE-only case** have no new QA tests here: their module tests are
  thorough (`deadpool/pack-cards.test.ts`, 1900 lines) and the expert games run them only when the driver reaches them.
  Each is covered by one of the existing tests, not by an interaction test.
- **Anti-Regeneration Ray, Tabula Rasa 16 and the Regeneratin' Degenerate** together are covered by the existing
  `dreadpool.test.ts` and `precon-e2e.test.ts` tests only.
- **Replay of the targeted tests.** Only the expert games are replayed to a deep-equal state; the targeted tests assert
  state and events.
- **Two players with the same hero** cannot be seated (unique identities); the "two 'Pool players" cases use Cable with the
  'Pool aspect (his hero cards, the Deadpool precon's 'Pool cards in place of Leadership).
- A passing file is a claim, not a guarantee: coverage is thin on X-23's upgrades with three or four players (Now I'm Mad,
  Endurance and Adamantium Lacing on another player's hero) and on cross-pack interactions with the Psylocke and Angel packs.
