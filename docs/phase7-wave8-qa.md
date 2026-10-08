# Phase 7 wave 8 rules-QA pass: the five Age of Apocalypse scenarios played as whole games

`rules-qa-engineer`, 2026-10-08, branch `feature/wave-8`. Scope: Unus the Untouched, The Four Horsemen, Apocalypse, Dark Beast and En Sabah Nur
(MC45 pp. 8 to 19), each built by `wave8Scenario` with the real registry (`WAVE8_DEPS`) and played from setup. Test file:
`packages/cards/src/wave8/scenario-games.qa.test.ts` (about 50 tests, about 150 s). No engine, script, data or client file was touched.

## 1. What was audited, and how

Until this pass the five scenarios had never been played as games. Their card scripts are unit tested on a Rhino game with fields swapped in
(`wave8/aoa/{unus,four-horsemen,apocalypse,dark-beast,en-sabah-nur}.test.ts`), the builder's tests stop after the first villain phase
(`wave8/setup.test.ts`), and the rulings pass is `wave8/rulings.qa.test.ts`. This pass adds the whole game: setup, the villain and player phases, stage
changes and the end, driven one command at a time by the shared greedy driver (`packages/cards/src/testing/driver.ts`, unchanged) with a different wave 8
hero's starter deck in each game (`wave8StarterDeckSetup`).

Per-command invariants on every game, natural or staged: the engine accepts the command (`sessionApply`), no prompt without an answer
(`minSelections` fits the options), the game never rests between steps with nothing pending outside a player turn, no card in two zones, every card a
deck started with (the set-aside zone included) and every encounter card setup created is still somewhere, and the log replays to the identical final
state. The scenario checks are in section 3; each is asserted on every occurrence, not only the first.

Sources: the card text in `packages/content/src/data/aoa/cards.ts`, RRG 1.8 (`mc_rulesreference_v18_compressed.pdf`) as cited in the test comments (Defeat
p. 15, Villain Defeat p. 47, main scheme last stage p. 27, Standard Set p. 40), MC45 rulebook pages as cited in the scenario rows, and the owner rows of
`docs/phase7-wave8.md` section 4.1 (Q5 the counter moves one place from the holder, Q10 Standard III, Q16 the stage keeps the form).

## 2. Games played

Standard unless marked. "Duo" is two players with two different heroes, stopped at an outcome or after five full rounds. Every game below held every
invariant and replayed to the identical state. The driver loses nearly everything, as expected: **no natural game was won**.

| Scenario      | One player, standard (seed, hero: outcome)                     | One player, expert                                                 | Two players (seed, heroes)                                                                              |
| ------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Unus          | 1 Bishop: all defeated, 2 rounds. 2 Magik: scheme completed, 4 | 7 Jubilee: all defeated, 3. 8 Magneto: scheme completed, 6         | 9 Bishop + Jubilee: no outcome at 5 rounds. 10 same with `genePoolThreatPerPlayer: 2`: all defeated, 3  |
| Four Horsemen | 1 Iceman: scheme completed, 2. 2 Jubilee: scheme completed, 4  | 7 Nightcrawler: scheme completed, 3. 8 Bishop: all defeated, 2     | 14 Magik + Magneto: scheme completed, 4. 12 same with `horsemanSides` A, B, B, A: all defeated, 4       |
| Apocalypse    | 1 Magneto: all defeated, 2. 2 Nightcrawler: all defeated, 2    | 7 Magik: all defeated, 3. 8 Iceman: all defeated, 2                | 9 Iceman + Nightcrawler: all defeated, 4. 10 same with `easierStart`: all defeated, 3                   |
| Dark Beast    | 1 Bishop: scheme completed, 2. 2 Magik: scheme completed, 3    | 7 Jubilee: scheme completed, 3. 8 Magneto: all defeated, 3         | 9 Jubilee + Bishop: scheme completed, 3. 10 same with Standard III as the standard set: all defeated, 3 |
| En Sabah Nur  | 1 Iceman: all defeated, 2. 2 Jubilee: all defeated, 7          | 7 Nightcrawler: scheme completed, 4. 8 Bishop: scheme completed, 4 | 9 Magneto + Magik: all defeated, 3. 10 same with Standard III: no outcome at 5 rounds                   |

All six heroes (Bishop, Magik, Iceman, Jubilee, Magneto, Nightcrawler) appear across the 30 natural games, rotated per scenario and mode. The
four setup options are each in one seeded two-player game (the rightmost column) and have a setup-only test beside it: Gene Pool +4 threat for 2 per
player on 2 players and no change from expert mode alone; Standard III cards and no Standard cards in the deck for Dark Beast and En Sabah Nur (and the
reverse without the option); War and Death on side A and Famine and Pestilence on side B; Apocalypse at stage I with 8 hit points and 8 target threat per
player (16 on 2) against stage II without the option.

## 3. Scenario checks, seen in play

Counts are occurrences (states or events), not games. **Natural** = in a driver-played game from setup. **Staged** = state surgery once (damage, threat,
form, the hero ready) before a real command, with the same invariants and a replay of each segment.

| Scenario      | Check                                                                                                                                                       |      Natural |    Staged |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -----------: | --------: |
| Unus          | Gene Pool below 3 threat: no retaliate, stalwart or amplify (tier 0)                                                                                        |           20 |         0 |
| Unus          | 3 to 5: retaliate 1 only                                                                                                                                    |          121 |         0 |
| Unus          | 6 to 8: retaliate 1 and stalwart                                                                                                                            |          126 |         0 |
| Unus          | 9 and up: also an amplify icon                                                                                                                              |           75 |         0 |
| Unus          | 45062b places 1 threat on Gene Pool after step one of each villain phase (and the counts of phases and responses agree to within a step-one loss)           |           26 |         0 |
| Four Horsemen | Row is a permutation of the four, counter on the leftmost, one side scheme per player at setup; different seeds give different rows (asserted)              |    all games |         0 |
| Four Horsemen | Each `nextInRow` move starts at the holder and ends one place to the right (wrapping), in order within a command (Q5)                                       |           34 |         0 |
| Four Horsemen | A Horseman at 0 hit points stays in play, nobody is defeated unless all four are                                                                            |           15 |         8 |
| Four Horsemen | Three at 0, the fourth's last hit point: all four defeated, game won (`allVillainsDefeated`) (see finding F1)                                               |            0 |         1 |
| Apocalypse    | Heart of the Empire comes with one Prelate at setup; each chained scheme that comes into play or flips brings a Prelate                                     |            6 |         7 |
| Apocalypse    | No threat comes off a chained scheme while a Prelate is in play (asserted on every `threatRemoved`; a direct thwart is also tried)                          | every thwart |         1 |
| Apocalypse    | Completing the main scheme at stage I, II, III reveals the next stage, no loss: I to II / II to III / III to IV                                             |    0 / 1 / 1 | 1 / 1 / 1 |
| Apocalypse    | Completing it at stage IV loses (`mainSchemeCompleted`, stage index 3)                                                                                      |            0 |         1 |
| Apocalypse    | The Throne falls: No Longer Worthy attached to Apocalypse, 5 healed per hero, a Prelate in play, no damage to him; killing the Prelate then Apocalypse wins |            0 |         1 |
| Dark Beast    | At most one Setting environment in play (45127, 45133, 45139 "Discard each other Setting environment")                                                      |          304 |         8 |
| Dark Beast    | His attack resolves the Setting's Special (45118 to 45120), across the target prompt                                                                        |           22 |         0 |
| Dark Beast    | The stage change brings a new Setting, one only, from another set (standard I to II, expert II to III); the last stage's defeat wins                        |            0 |         2 |
| En Sabah Nur  | A form change is a flip: no stage change, no reveal of the villain, the new face showing                                                                    |           18 |         2 |
| En Sabah Nur  | The fourth power counter comes off and a SUPERPOWER card is revealed                                                                                        |           10 |         0 |
| En Sabah Nur  | The new stage keeps the form it was defeated in (Q16), forms A, B and C                                                                                     |            0 |    1 each |

Not seen naturally and so staged: the Apocalypse stage I to II (easier start only), No Longer Worthy, the Horsemen falling together, Dark Beast's stage
change, and En Sabah Nur's stage change. The driver is dead before it kills a stage of any villain.

## 4. Staging notes (so a reader does not mistake a staged state for a play state)

- **A damage counter set straight to 0 is not a play state for the Horsemen.** The engine watches a Horseman at 0 from the first defeat check that passes
  over it (`resolve/defeat.ts`); a Horseman whose damage was patched to its hit points has never had that check, and it is not defeated when the others
  fall. The staged fall-together therefore takes each of the first three Horsemen to 0 with a real attack (`readyToFall`). This is an artifact of
  patching, not a defect: every damage that reaches 0 in play runs the check.
- A `tough` status on a villain absorbs the attack that would defeat a staged one; `withDamageOn` clears it.
- The Apocalypse chain is a sequence of segments, each its own session (and log) started from the previous end state with one patch: the Prelate to 99
  damage, then the scheme to 1 threat, the hero ready each time.

## 5. Findings

| #   | Where                        | Expected                                                                                                                                                                                                                                                                                            | Actual                                                                                                                                                                                                                                                                                                                                                                                                                          | Status                                                                                                                                                                     |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Four Horsemen 45081 to 45084 | "Cannot be defeated while another villain has at least 1 hit point" plus `docs/phase7-wave8.md` section 3.9 ("all four are defeated in one step"): the blow that takes the last hit point ends the game in that command, and nobody is asked which Horseman is active next, since none will be left | The counter's holder is always one of the four. It is defeated alone (1 defeated), the player is asked to choose the next active villain (`chooseTarget`, slot `_nextActiveVillain`, 3 options); the first answer defeats a second Horseman and asks again (2 options); the second answer defeats the last two and wins the game. Same outcome, but two meaningless prompts and game states with 1 and then 2 Horsemen defeated | Pinned: `it.fails` "the killing blow ends the game in the same command, with no prompt" and a companion of today's behavior. For the owner (low severity, no wrong result) |

No other defect was found. The checks that could have caught one and did not: Gene Pool's tiers on 342 states across 6 Unus games (including 2 expert and
2 two-player), the counter's 34 moves, the Prelate lock on every thwart of a chained scheme, the stage reveals (no loss at I to III, a loss
at IV), the single Setting on 312 states, and the form changes (18 commands with a flip, none revealing the villain).

Test-model gaps found and fixed in the test itself (not engine defects): a hero's set-aside cards enter play (Magneto's 49033 reached the discard pile
in a Dark Beast game), so the "every card accounted for" baseline counts the set-aside zone as the owner's; and the Horsemen state check allows the
transient F1 prompt. A first draft of the Dark Beast check asserted "one environment" from the RRG; the Setting cards' own text is the source, and other
environments from a modular set may legitimately sit beside a Setting.

## 6. Open owner questions

- **F1 above:** is the prompt for the next active Horseman on the fall-together acceptable (as built), or should the four be defeated in one step with no
  prompt? Recommended: no prompt; the result is unchanged either way.
- **Q54 (on the PR):** "You Got This!" and which stat applies to a thwart made with an ATK stat. Not exercised by these games.
- **Q55 (on the PR):** whether an effect-declared hero defender counts as a basic defense. Not exercised by these games.

## 7. Not covered, and confidence

- **No campaign game is played to its end by a test.** These games are single scenarios in standard and expert; the Age of Apocalypse campaign definition
  (`campaigns/aoa.ts`) is exercised by its own tests and by the mission tests, not by a scenario played from the campaign.
- **No natural win, and no natural stage change of any villain.** The driver kills nothing larger than a minion, so every villain-defeat, stage-change and
  win path above is staged: patched damage once, then real commands. A passing staged segment shows the engine does the right thing from that state, not
  that a driver, or a player, reaches it.
- **Magneto's precon never reaches You Got This! or Exodus** (and the other hero kits are reached only as far as the driver plays them); these games add
  scenario coverage for Magneto, not kit coverage.
- **Expert Unus's facedown card per player** (45062a Setup) is not asserted: the first villain phase reveals it before the first player turn the harness
  stops at. Expert Four Horsemen with all four on side B, and expert Apocalypse at stage III, are played but only the generic and stage checks are made.
- **Heroic and skirmish modes, three and four players, and the campaign variants** of these scenarios are not played. Two players is the largest table.
- **Dark Beast's Evil Genius, Time-Travel Shenanigans, High-Tech Goggles and Genetic Enhancement; En Sabah Nur's Staggering Strength; the Prelates'
  individual abilities; Apocalypse's Cyberpathy, Biomorphing, Molecular Control, The Fittest and Wolf Among Sheep** are exercised only as far as natural
  draws reached them (the generic invariants hold); their targeted tests are the unit tests of each module.
- **Time and sample size.** Six natural games per scenario is a small sample, and one hero precon each at a time; seeds were also picked for the shorter
  Four Horsemen games. The file runs in about 150 s because the engine spends about 30 ms per command and the driver probes every candidate.

A passing run of this file is a claim about the games and states above, not about the five scenarios in general.
