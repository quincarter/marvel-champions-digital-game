# Phase 7 wave 7 rules-QA pass: NeXt Evolution scenarios, slice 1 (Morlock Siege, On the Run, Juggernaut)

`rules-qa-engineer`, 2026-10-05. Scope: the three scenarios' own cards (Morlock Siege 40077-40089, On the Run
40103-40111, Juggernaut 40118-40129), the Marauders set (40070-40076, both faces), the Mutant Slayers minions they use
(40094-40102) and Hope Summers (40130, 40131) against the printed text in `packages/content/src/data/next_evol/`, RRG 1.8
(`mc_rulesreference_v18_compressed.md`; page numbers are the printed pages given by its index) and
`marvel-champions-rulings-post-rrg-1-7.md`. Owner rulings of `docs/phase7-wave7.md` section 4.1 were taken as given. Test
file: `packages/cards/src/wave7/next_evol/qa-scenarios-1.qa.test.ts`; no engine, script or data file was touched.

Not in this slice: Military Grade, Nasty Boys, Black Tom Cassidy (the other two QA agents), the other two scenarios, the
heroes, the campaign. Black Tom Cassidy and Nasty Boys appear only as the recommended modular sets some games draw.

## 1. Sources

| Source                                                                                                                                                       | Used for                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| RRG 1.8 "Would", p. 48: "would" gives an interrupt higher timing priority than interrupts to the same trigger without "would"                                | Hope's Captor against the Marauders' "attacks you" interrupts (finding 2, fixed)       |
| RRG 1.8 "Interrupt", p. 25: once an interrupt replaces what is about to occur, further interrupts to the original trigger cannot be used                     | The same                                                                               |
| RRG 1.8 "Attack (Enemy Activation)", p. 9, step 2: a defending player other than the target player becomes the target player                                 | Who "you" is for Hope's Captor and Morlock: the player the activation began against    |
| RRG 1.8 "Villain Defeat", p. 47: same-title new stage keeps attachments, statuses and counters; a different title keeps none                                 | Juggernaut I to II to III (momentum, Helmet carry over); Routed (nothing carries over) |
| RRG 1.8 "First Player", p. 19, and "Player Elimination", p. 34: the token passes clockwise at the end of the round and at once when its holder is eliminated | Token and Hope Summers's control in 3 and 4 player games, with eliminations            |
| RRG 1.8 "Boost", pp. 9 and 11 and "Villainous", p. 47: a minion without villainous is dealt no boost card                                                    | Why the Mutant Slayers minions have no extra-boost option (script comment confirmed)   |
| Owner rulings Q4, Q5, Q6, Q7, Q8, Q9, Q10, Q11, Q13, Q14, Q15 (`docs/phase7-wave7.md` section 4.1)                                                           | Expected behavior of the cards they name; every one agrees with the scripts read       |

No FAQ entry on pp. 55 to 64, erratum on pp. 65 to 69 or post-1.7 ruling names a card of these sets. The existing unit
tests (`marauders.test.ts` 946 lines, `morlock-siege.test.ts`, `on-the-run.test.ts`, `juggernaut.test.ts`,
`hope-summers.test.ts`) already cover each card in isolation and most owner rulings; this pass added whole games and the
card-against-card interactions they cannot reach.

## 2. Card-by-card audit (printed text against script)

Printed text read from the emitted data (`printed` strings) and compared with the script line by line. "OK" means the
script does what the card says, the data carries the keyword, icon and stat modifier the card shows, and a unit test
asserts it. Statistics (HP, ATK, SCH, threat) were checked for internal consistency only; the repo has no printed
card images or card database to compare them with (see section 6).

| Cards                                                                                                                      | Result                                                                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Arclight, Vertigo, Chimera, Greycrow, Harpoon, Riptide, Blockbuster (40070-40076 a and b)                                  | OK: every option and every B-face difference matches (highest THW / ATK, two mental, discard each tied card, 3 indirect damage and overkill, 3 threat and ranged and piercing, overkill). Finding 2 (and the withdrawn finding 1) touch their interrupts                                       |
| Knock, Knock 40077, Mutant Massacre 40078                                                                                  | OK, including 2 Morlocks for a one-player game, "each player" otherwise (the games' invariant counts the players still in the game), tough only for a knock advance, the loss text                                                                                                             |
| Morlock 40079                                                                                                              | OK (Victory -1, ally limit, cannot be removed by card abilities, redirect); finding 1 withdrawn                                                                                                                                                                                                |
| Hide! 40080, Routed 40081 a/b, Bolstered by Wrath 40082, Pushed to the Limit 40083                                         | OK (expert retaliate counts every card under Routed; a different-title new villain keeps nothing)                                                                                                                                                                                              |
| 40084-40087 side schemes, Back in Action 40088, Seek the Weak 40089                                                        | OK                                                                                                                                                                                                                                                                                             |
| Gotta Get Away 40103, Escaping with Hope 40104                                                                             | OK (every other villain is removed from the game and no minion shares the villain's title: asserted at every state of three games)                                                                                                                                                             |
| Hope's Captor 40105 a/b                                                                                                    | OK against Q9 and Q10; finding 2 fixed (2026-10-06)                                                                                                                                                                                                                                            |
| Hidden in the Clutter 40106, Favored Weapon 40107, Bushwhack 40108, Pure Force 40109, Dizzying Deeds 40110, Tag Team 40111 | OK. 40106's "Then, discard this card" is read as part of the 3-damage sentence (script comment, "rules question 1"); the printing allows both readings. Open, not a defect: see question 2. The known engine gap (tough status on the attached enemy) stays `it.fails` in `on-the-run.test.ts` |
| Mutant Slayers minions 40094-40100, 40101, 40102 (as On the Run's required set)                                            | OK, and consistent with the Marauders villains; Harpoon's minion text ("+2 ATK and piercing") matches its script                                                                                                                                                                               |
| Juggernaut I, II, III 40118-40120, The Unstoppable Juggernaut 40121                                                        | OK (counters and Helmet carry over a same-title stage change; the four numbered steps run as one interrupt)                                                                                                                                                                                    |
| Helmet and Exposed 40122, Head of Steam 40123, Building Momentum 40124                                                     | OK                                                                                                                                                                                                                                                                                             |
| Breakthrough 40125, Flatten 40126, Ground Pound 40127, Trample 40128, Cyttorak's Exemplar 40129                            | OK                                                                                                                                                                                                                                                                                             |
| Hope Summers 40130, Captive Hope 40131                                                                                     | OK against Q14 and the first-player-control ruling; the invariants hold over 3 and 4 seats, a wrapped token and eliminations                                                                                                                                                                   |

Mismatches between printed text and script: none. Finding 2 was an engine timing defect, fixed on 2026-10-06, and
finding 1 was withdrawn. One observation (not a rule): an activation made by an effect (Routed's "the villain activates against
each player") logs `attackResolved` or `schemeResolved` but no `enemyActivated` for a scheme against an alter-ego
player, while the villain phase logs one; a log reader should not count `enemyActivated` for those.

## 3. Whole games (new)

All through `wave7Scenario` and the real registry, played command by command by the greedy driver (with the policies named
below), every state checked against the invariants in the file header, then `replay(log)` compared deep-equal with the
final state. Heroes are Core precons (Spider-Man, Captain Marvel, Iron Man, Black Panther in seat order), each scenario
with its recommended modular sets. Seeds were chosen by a temporary scan of seeds 1 to 14 (deleted).

| Game          | Mode     | Players | Seed | Policy                                | Rounds completed, outcome          | What it reached                                                                                          |
| ------------- | -------- | ------- | ---- | ------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Morlock Siege | expert   | 1       | 7    | attack first                          | 5, loss (main scheme)              | 2A by knock counters, 2 Morlocks, a redirect, 1 villain under Routed (retaliate), new villain activation |
| Morlock Siege | standard | 3       | 3    | attack first, tilted                  | 4, loss (no Morlock in play)       | knock advance, 7 redirects, a villain under Routed, token passes 4                                       |
| On the Run    | standard | 3       | 4    | thwart first                          | 2, loss (Gotta Get Away completed) | a Hope's Captor scheme                                                                                   |
| On the Run    | expert   | 4       | 11   | thwart first                          | 2, loss (Gotta Get Away completed) | 32 threat to complete, one MARAUDER minion each from 1B, 2 token passes                                  |
| On the Run    | expert   | 2       | 2    | attack and thwart first, tilted       | 1, loss (stage 2 completed)        | Hope's Captor flip, 2A search for each player, tough on every MARAUDER enemy, stage 2                    |
| Juggernaut    | expert   | 1       | 11   | thwart first                          | 4, loss (all players defeated)     | Juggernaut II start, 2 momentum counters, the Helmet's Action once                                       |
| Juggernaut    | standard | 4       | 8    | thwart first                          | 4, loss (all players defeated)     | Hope Summers held by at least three seats, 4 token passes with eliminations                              |
| Juggernaut    | expert   | 3       | 2    | thwart first, third seat first player | 6, running (round cap)             | the token wraps P3 to P1 and Hope Summers goes with it, 2 passes                                         |
| Juggernaut    | expert   | 1       | 4    | attack and thwart first, tilted       | 1, loss (all players defeated)     | Juggernaut II defeated, III revealed, momentum and Helmet carried over                                   |

Whole file: about 45 s on this machine, 16 tests, all passing (no `it.fails` pin is left).

Policy, said plainly. The greedy driver loses most seeds of these scenarios to the main scheme or to the Marauders within
one to four rounds (On the Run especially: with a MARAUDER minion engaged, Hope's Captor makes the villain scheme at every
player: none of the 14 seeds scanned for each of a two-, three- and four-player game lasted more than four rounds, and most ended with Gotta Get Away completed). Two
policies sit in front of the driver: "thwart first" (a ready hero or ally thwarts the main scheme before the driver acts)
and "attack first" (the same against the villain). "Tilted" games start from surgery on the initial state: the villain on
2 hit points, no tough status card, no engaged minion (so nothing guards it), so a defeat comes in round 1; the surgery is
in the log's initial state and replays. Nothing else is staged. No game wins: the driver ends in a loss, as in the other
passes. Coverage that depends on a win (Routed's third villain, Escaping with Hope's win after the second defeat) rests
on the unit tests only.

## 4. Findings

| #     | Card(s)                                                                                 | What is wrong                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Rule                                                                                                                                                                                                                                                              | Severity              | Who fixes                                                                                                                                            | Pinned test                                                                                                                                                                                                                                                 |
| ----- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~1~~ | **Withdrawn (2026-10-06).** Morlock 40079 with Harpoon 40074a and Cosmic Flight 01017   | ~~An enemy attack on a player who controls a Morlock lands on the hero when Harpoon's "Take 2 indirect damage" is answered by Cosmic Flight: the redirect is lost or undone.~~ Withdrawn: not a bug. Cosmic Flight is a "Hero Interrupt (defense)", and RRG 1.8 "Defend, Defense" (pp. 14-15) says a player who initiates a triggered ability labeled as a defense during an enemy attack makes their identity the defender "if there is not already a defender". The player chose to defend. Morlock ordered first: the attack is retargeted to the Morlock, then Cosmic Flight makes the hero the defender and the attack lands on the hero. Harpoon ordered first: the hero is already the labeled defender when the Morlock's interrupt resolves and the retarget is refused. Both logs carry a `defended` trigger event for the hero (`basic: false`). With the indirect damage simply taken, the attack lands on the Morlock in both orders.                                                                                                                                                                                                                                         | ~~Morlock 40079, owner Q6 = A, RRG p. 10~~; RRG "Defend, Defense" (pp. 14-15)                                                                                                                                                                                     | None                  | None (engine owner checked)                                                                                                                          | `Staged: Morlock's redirect (40079) against Harpoon's Forced Interrupt (40074a)`: now passing `it.each` (defended, two orders), plus indirect damage taken (two orders), control passes                                                                     |
| ~~2~~ | **Fixed (2026-10-06).** Hope's Captor 40105a/b with every Marauder (villain and minion) | ~~The villain's own "When X attacks you" Forced Interrupt resolves for an attack that Hope's Captor then replaces with a scheme: the first player is offered the two as one ordering and, ordered first, Arclight's confuse (or Vertigo's stun, Riptide's threat, Greycrow's discard, Harpoon's indirect damage, Chimera's spend) is paid for an attack that never happens. With Captor ordered first the replacement works and the other interrupt is not used~~ Fixed by the owner ruling of 2026-10-06 (`docs/phase7-wave7.md` 4.1): a "would attack" replacement resolves before any "attacks you" interrupt; the two are not simultaneous and the first player is not asked to order them. The engine's interrupt window now has an earlier tier for interrupts marked `would` (forced, then optional, ordered among themselves), resolved before the event's other interrupts are gathered; a replaced or cancelled attack never opens the later tier. Hope's Captor is marked on both faces, with the other "would attack" and "would scheme" replacements. With no MARAUDER minion engaged Captor resolves, replaces nothing, and the Marauder's interrupt then resolves as before | RRG 1.8 "Would", p. 48 (a "would" interrupt has higher priority than an interrupt to the same trigger without it) and "Interrupt", p. 25 (a replaced trigger allows no further interrupts); Q9 says Captor replaces every attack "before the boost card is dealt" | Resolved (was medium) | Done: `game-rules-architect` (`trigger.would`, `packages/engine/src/resolve/window.ts`; tests in `packages/engine/src/would-interrupt-tier.test.ts`) | `Staged: Hope's Captor (40105a) against the villain's own Forced Interrupt`: two plain passing tests (a minion engaged: no ordering prompt, the villain schemes, Arclight's interrupt unused; no minion engaged: Captor then Arclight, the attack resolves) |

Repro of finding 1 (withdrawn, see the table; the "Actual" below is the correct outcome of a chosen defense), Morlock Siege, Captain Marvel (Core) with Cosmic Flight attached, hero form, Knock, Knock at 2 knock
counters and no threat, Harpoon the villain (SCH 0). The villain phase advances to 2A (2 Morlocks under P1), Harpoon
attacks P1, the first player orders the interrupts, "Take 2 indirect damage" is chosen, the 2 damage is assigned to the
hero and Cosmic Flight is taken. Actual: `attackResolved` targets the hero's identity (`01010a`). Expected: a Morlock
(`40079`). In the 3 player game the event log shows the Morlock interrupt resolve with `targetChosen` and no
`attackRetargeted` (Harpoon ordered first) or `attackRetargeted` followed by the hero as target (Morlock ordered first).
With "Give Harpoon 1 additional facedown boost card" the same state lands on the Morlock, and so does Harpoon's indirect
damage when nothing prevents it, so the defect is the prevention inside the interrupt, not the redirect. Cause not
located; the engine files for an attack's target and `damagePrevented` are the place to start.

Repro of finding 2 (fixed 2026-10-06, see the table), On the Run, Arclight the villain, Spider-Man in hero form, a
MARAUDER minion engaged from 1B. Before the fix the first player was offered Arclight's interrupt and Hope's Captor's in
one ordering prompt (`orderTriggers`) and, with Arclight's ordered first, the log read `abilityResolved
40070a.arclight-forced-interrupt`, a status card given, then Captor's replacement and a scheme. Now the attack's interrupt
window opens its "would" tier alone (`windowOpened` with `would: true`, Captor its only candidate), Captor replaces the
attack with a scheme, and no window opens for Arclight's interrupt or for Spider-Sense.

## 5. Owner questions

Open, from the withdrawn finding 1 (engine owner's recommendation first):

- **Q-A. A (defense) ability used against damage that is not the attack's own.** Harpoon's indirect damage is not the attack's damage.
  - **A (as built, recommended):** using a (defense) ability during the attack still makes the hero the defender.
  - **B:** only a (defense) ability that answers the attack's own damage makes the hero the defender.
- **Q-B. The hero is already the labeled defender when the Morlock's forced redirect resolves.**
  - **A (as built, recommended):** the redirect does not retarget.
  - **B:** retarget to the Morlock and clear the defender.

From finding 2:

1. **Hope's Captor against the Marauders' own interrupts (finding 2). Answered 2026-10-06: A.** Does Hope's Captor's
   "would attack" outrank the Marauder's "attacks you" interrupt?
   - **A (owner's ruling, built):** yes, as RRG 1.8 "Would" (p. 48) reads: Captor resolves first, the Marauder's
     interrupt is never used for a replaced attack, and the first player has no ordering to make.
   - ~~**B:** no: both are forced interrupts to the attack, the first player orders them, and the Marauder's choice may
     be paid for an attack that is then replaced.~~ This was the engine's behavior before the ruling.
2. **Hidden in the Clutter's "Then, discard this card" (not a defect, raised in the script's "rules question 1").** Is the
   discard part of the 3-damage condition?
   - **A (recommended, as built):** yes, the card stays and keeps absorbing damage until 3 are on it.
   - **B:** no, the card is discarded after any damage is placed on it, whether or not the attack happens.

## 6. Not covered, and confidence

- **No game wins.** Routed's win (three villains under it), Escaping with Hope's win after the second defeat and
  Juggernaut's win after Juggernaut III are asserted by unit tests only. Of the rounds a driver game reaches in these
  scenarios, 2A of Morlock Siege, 2A of On the Run and the Juggernaut stage change are reached, never the last stage.
- **Printed statistics.** HP per player, ATK, SCH, starting and target threat, acceleration and boost icons were not
  compared with the printed cards (there is no card image or database here to compare with); they were read for internal
  consistency only (for example, expert faces larger than standard faces, the 2 and 3 per player scaling checked by the
  state invariants).
- **Order of the Unstoppable Juggernaut's attacks** (40121b step 4: each player in player order) is asserted in a two-player
  unit test, not in a driver game: a player's own card (Webbed Up, 01009) can cancel the attack and the log then holds no
  attack for that player, so a whole-game check cannot tell a cancelled attack from a missing one.
- **Tough, Retaliate and Overkill interactions on the Morlocks and the villain** are exercised by the games only as far as the
  driver reaches them; the targeted ones are unit tests.
- **Alter-ego players against Marauders**, the Hide! and Back in Action boosts against more than one Morlock, and Dizzying
  Deeds with Riptide in a game larger than two players: unit tests cover one and two players.
- **Expert Greycrow / Chimera / Harpoon B and Arclight B with an ally as the highest value** (ties between a hero and an
  ally): covered at one and two players in `marauders.test.ts`, not in a driver game.
- **Military Grade attachments on the villains**, Nasty Boys and Black Tom Cassidy cards drawn in these games are checked by
  the generic invariants only; the other QA agents own them.

A passing run of this file is a claim about the games and states above, not about the three scenarios in general.
