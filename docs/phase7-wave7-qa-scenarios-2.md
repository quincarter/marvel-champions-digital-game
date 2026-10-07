# Wave 7 rules QA, slice 2: Mister Sinister, Stryfe and the nine modular sets

Step 4 of docs/wave-definition-of-done.md for the `next_evol` box. Test file:
`packages/cards/src/wave7/next_evol/qa-scenarios-2.qa.test.ts` (44 tests, about 46 s on a loaded machine). Sources:
RRG 1.8 (pages cited), `marvel-champions-rulings-post-rrg-1-7.md` (dated), docs/phase7-wave7.md §4.1 (not re-opened).

## Card-by-card audit

Every card of `mister_sinister` (40136-40150), `stryfe` (40163-40179), `hope_summers` (40130-40131), `flight`,
`super_strength`, `telepathy` (40151-40162), `nasty_boys` (40112-40117), `black_tom_cassidy` (40132-40135),
`extreme_measures` (40180-40184), `military_grade` (40090-40093), `mutant_insurrection` (40185-40189) and
`mutant_slayers` (40094-40102) was read as printed in `packages/content/src/data/next_evol/cards.ts` against its script.

Mismatches between printed text and script: **none that is a plain misreading.** One card's _rule_ is in question:

- Telekinetic Wave 40179 says "Return an upgrade or support you control to **your hand**" and the script moves the card
  into the revealing player's hand. When the card is another player's (an upgrade P1 attached to Hope Summers, which P2
  controls once the first player token passes, RRG p. 31: "Upgrades on a card that changes control also change control"),
  RRG p. 31 says a card that leaves play "is placed in its **owner's** equivalent out-of-play area". The engine puts P1's
  card into P2's hand. Cerebral Erasure 40175 prints "owner's hand" and is correct. See finding F1.

Readings checked and found consistent with the printed text and the owner answers: Mister Sinister I-III threat numbers
(including the expert order, MC40 p. 21), all three SUPERPOWER attachments' traits and keywords, Sinister Disguise's
fewest-hit-points target (RRG p. 19 tie), Stryfe's three stages, Uncontrollable Power and Left to Your Fate, Living Bomb
(Q19, Q21), Hope Summers' three paragraphs (Q14, Q16), Extreme Measures' printed-cost indirect damage, Mutant Insurrection
counting Stryfe as an MLF character, Nasty Boys' Teamwork (RRG p. 43), Get Nasty's double count, Black Tom's Willow rules.

Not cross-checked card by card (thin): Military Grade and Mutant Slayers beyond the matrix games and their own files;
Dragoness, Forearm and Reaper count "resources in your hand" and treat a printed wild icon as the named type (Q40's
reading); no staged test here proves that.

## Games played

All seeded, one command at a time through the greedy driver, every state checked (soft locks, two-zone cards, card
ownership, unique cards, restricted limit, side scheme limit, Hope Summers exactly one and under the first player with
her hero's stats while the table is bare, SUPERPOWER attachments one of each with exactly the trait and keyword each
gives, the other sets' cards set aside whole or gone), each replayed to a deep-equal final state. P1-P4 are the Cable,
Domino, X-23 and Psylocke precons in that order.

| Scenario        | Mode     | Players | Modular                    | Seed | Cap (round) |
| --------------- | -------- | ------- | -------------------------- | ---- | ----------- |
| mister-sinister | expert   | 1       | none                       | 7    | 5           |
| mister-sinister | expert   | 2       | none                       | 2    | 5           |
| mister-sinister | expert   | 3       | none                       | 1    | 4           |
| mister-sinister | expert   | 4       | none                       | 3    | 4           |
| stryfe          | expert   | 2       | none                       | 2    | 5           |
| stryfe          | expert   | 3       | none                       | 5    | 4           |
| stryfe          | expert   | 4       | none                       | 2    | 4           |
| stryfe          | standard | 3       | none                       | 1    | 4           |
| stryfe          | standard | 4       | none                       | 6    | 4           |
| stryfe          | standard | 2       | Flight, Black Tom Cassidy  | 1    | 4           |
| stryfe          | standard | 2       | Super Strength, Mil. Grade | 1    | 4           |
| stryfe          | standard | 2       | Telepathy, Mutant Slayers  | 1    | 4           |
| stryfe          | standard | 2       | Nasty Boys, Telepathy      | 1    | 4           |
| mister-sinister | standard | 2       | Extreme Measures           | 1    | 3           |
| mister-sinister | standard | 2       | Mutant Insurrection        | 3    | 3           |
| mister-sinister | standard | 2       | Military Grade             | 1    | 3           |
| mister-sinister | standard | 2       | Mutant Slayers             | 1    | 3           |
| mister-sinister | standard | 2       | Black Tom Cassidy          | 1    | 3           |

Outcomes are the driver's: most games end in a loss (main scheme completed, or all players defeated, or Hope Summers
defeated) or stop at the cap with no outcome; no game ended in an engine error. The games did not reach Sinister Ends
(stage 3), so that stage is covered only by the staged tests below. Setup runs for 1-4 players in standard and expert
for both villains (hit points per hero, threat, Grasp, Stage II attachments, Hope).

## Staged tests (each cites its rule)

Setup numbers by player count; Hope Summers across a 3-player round cycle (control and stats follow the token, 0 in
alter-ego form, Q14 = B); Uncontrollable Power at 3 players (per-player X, player order, a discard before X);
Mister Sinister's stage walk at 3 and 4 players with the real SUPERPOWER scripts; Sinister Ends 3B at 3 players with the
real Hope (every redirected attack is against Hope, the first player is the attacked player and the defender prompt goes
to them, Q16); Sinister Strike at Sinister Ends; Stryfe at 4 players through Living Bomb to Stage II (Q19, Q21);
Mutant Insurrection with Stryfe (MLF) and without an MLF character (surge); Nasty Boys' Teamwork.

## Findings

| #   | Card  | What is wrong                                                                                                                                                                                                                                                                   | Rule                                                                           | Severity                                            | Who fixes                                                                                                                                                       | Pinned test                                                                                                                                     |
| --- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | 40179 | Telekinetic Wave returns an upgrade or support the player controls into **that player's** hand even when another player owns it (found when Hope Summers carries the first player's upgrade and the token has passed): the card ends in the controller's hand, not the owner's. | RRG 1.8 "Ownership and Control", p. 31 (leaving play goes to the owner's area) | Low (needs a card on Hope, a token pass and a Wave) | `ability-scripting-engineer` (the script's `moveCardsInto(..., "hand", you)`); `game-rules-architect` if the engine's `moveCardsInto` should clamp to the owner | `40179.when-revealed (Telekinetic Wave): P2 returns P1's upgrade carried by Hope Summers: it goes to its OWNER's hand (RRG p. 31)` (`it.fails`) |

## Owner question

Q-A (F1). Telekinetic Wave prints "to your hand"; RRG p. 31 sends a card that leaves play to its owner's area. Which
wins when the card is another player's?

- A (recommended): the owner's hand (RRG p. 31, as Cerebral Erasure's "owner's hand" already does); the player's own card
  goes to their own hand, so only the Hope Summers case changes.
- B: the revealing player's hand, as the script does (a card is "returned to your hand" and stays the other player's card).
- C: the revealing player may not choose a card they do not own.

## Not covered, and thin areas

- Sinister Ends reached in a whole game, Living Bomb walked to Left to Your Fate's loss, expert Mister Sinister III: only
  staged or earlier-file tests.
- Steady (Super Strength) with Sinister's status-card Forced Response: super-strength.test.ts proves steadiness, and the
  Forced Response is proven for tough cards; no test places a stunned or confused card on a steady Mister Sinister.
- Military Grade, Mutant Slayers, Dragoness, Forearm, Reaper, Samurai, Tempo, Thumbelina (TINY): played in the matrix games
  only as far as the driver reached them, plus their own files. No staged interaction test in this slice.
- Extreme Measures' "player card enters play" is scripted over every ally, support and upgrade; an encounter ally entering
  play (a Morlock) prints a dash cost, so no damage is visible, but the trigger matches it. Not proven either way here.
- X-23's In the Name of Vengeance (43030) gives every enemy retaliate 1: the games' "no retaliate without Telepathy"
  check skips games where it is in play.
