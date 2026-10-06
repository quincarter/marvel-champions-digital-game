# Wave 7 QA: the NeXt Evolution (MC40) campaign played end to end

File: `packages/cards/src/campaigns/next_evol.qa.test.ts` (20 passing tests, 1 `it.fails`). Rules: MC40 pp. 6-7, 9, 11,
14, 16, 18, 24 via docs/phase7-wave7.md §1.19-1.21, §2.10, §3.40-3.46 and §4.1 (Q24, Q25, Q28).

## How the games are played, and what is staged

Every game is built from the composed log (`wave7Scenario` + composed sets + `createGame`), settled, then played
one command at a time by the greedy driver with step invariants (no soft lock, no stall between steps, no card in two
zones, no card removed from the campaign in a game, one copy of each campaign face), and its session log is replayed to a
deep-equal state. Every real game replays deep-equal.

- Real: the scheme's defeat (scheme at 1 threat, then the first player's real `changeForm` + `basicThwart`; its When
  Defeated flips it and the environment enters play), every setup instruction, every Victory record derived by the runner.
- Staged by surgery at the end of the game (the driver cannot win; games are cut after 14 driver commands): outcome
  overridden to a win or loss, villains under Routed and Morlock allies in play (scenario 1), Hope Summers's damage
  (scenarios 3, 4), a seat eliminated (expert).
- Stand-in logs (`walk`) for tests that only need a setup (Morlock searches, the Hope choice, scenario 5 with all
  environments earned).

## What was played (seed 4242 unless stated; Spider-Man and Captain Marvel Core precons; 4 players adds She-Hulk and Iron Man)

| Leg | Players / mode | How |
| --- | --- | --- |
| Full campaign, Gear Up / Mission Prep / Assemble the Team / Practice Maneuvers / Prepare Defenses | 2, standard | five real games, schemes 1-4 defeated by the real thwart, scenario 5 won undefeated; log checked after each |
| Retry of scenario 3 after its scheme was really defeated in a lost game, then a win | 2, standard | real lost game, runner, no prompt (a prompt throws) |
| Retry of scenario 1, twice | 2, standard | |
| Removal: Establish Safehouse not defeated at the win in scenario 1; scenario 2 won; scenario 3 lost and retried, then won | 2, standard | real games |
| Scenario 2 after Marauders (3, either face) and Morlocks (0-4) | 2, standard, seeds 1-8 | setup only; control draw with nothing recorded |
| Scenario 4 (1 and 2 damage recorded) and 5 (all four earnable environments; 1 and 2 recorded), both options | 2, standard | setup only |
| Expert chain, seat 2 eliminated at the end of each win | 2, expert | five real games |
| Lost scenario 5, expert and standard | 2 | real game, loss |
| 4-player leg, scenarios 1-3 | 4, standard | real games |
| Black Tom set passed / not passed / named by the campaign start | 2, standard | setup only |

## The log after each scenario of the full run

| After | Struck / chosen | Encounter cards | Environments earned | Other |
| --- | --- | --- | --- | --- |
| 1 | Gear Up | 40203 | 40192b | Marauders 40070a, 40072a, 40074a; Morlocks saved 3 |
| 2 | + Mission Prep | + 40200 | + 40193b | Marauders and Morlocks unchanged |
| 3 | + Assemble the Team | + 40199 | + 40190b | Hope damage 3 = 1 |
| 4 | + Practice Maneuvers | + 40198 | + 40194b | Hope damage 4 = 2 (1 placed on her at setup) |
| 5 | Prepare Defenses chosen, 2 damage placed as threat on Stryfe's Grasp | + 40202 | (campaign won) | status won, nothing removed |

## Findings

| # | What | Cite | Severity | Fix by | Pin |
| --- | --- | --- | --- | --- | --- |
| 1 | A `CampaignDefinition` cannot name a required modular set: `startGameFromLog` for scenario 3 does not list `black_tom_cassidy`. A builder that passes another modular set gets a Juggernaut with no Black Tom and no facedown deal, silently | MC40 p. 14 (§3.43) | medium (builder default hides it) | `game-rules-architect` (a required-set field on `CampaignNode`) | `it.fails` in the last describe; the passed and not-passed behavior are passing tests |
| 2 | Scenario 5's Victory has no removal step, so an undefeated Prepare Defenses is never removed. Harmless: the campaign ends | MC40 p. 7 | none | none | asserted as designed |

No other defect found. Not a finding, but surprising: in scenario 2 the engine's `removedFromGame` already holds six
villain cards (the undrawn Marauders) even with nothing recorded, so the recorded removal is proven by the draw
(never a recorded title across 8 seeds, while the control draws one) rather than by that zone.

## Owner questions

1. Should the campaign carry its required modular set (finding 1)? Recommended: yes, a `requiredModularSets` field on the
   node, read by `startGameFromLog`; alternative: leave it to the game builder and document it.

## Not covered

- Scenario 3 and 4 wins reached by real play (the driver loses), the Marauders and Morlocks of scenario 1 are staged.
- Campaign cards' own Actions (Team Assembled search, Safehouse) in a played game; covered by the card unit tests.
- The client flow (the campaign is held out of the registry for now; the QA file imports the definition directly).
- 3 players (4 players covered), 1 player, heroic mode.
- Expert Stryfe won after a retry; seeds were not scanned (4242 and 1-8 for setup-only tests were enough).
