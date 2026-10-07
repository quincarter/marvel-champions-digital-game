# Phase 7 wave 7 rules-QA: full solo games with the seven 'Pool decks

`rules-qa-engineer`, 2026-10-07, branch `feature/wave-7`. The seven fixtures of `wave7/fixtures/pool-decks/` seated through `playableScenario`
(one seat, standard) against Rhino (Bomb Scare; the Dreadpool set joins exactly when the seat chose 'Pool), Morlock Siege and Mister Sinister, driven by
`qa-solo-driver.ts`. Test: `packages/cards/src/wave7/pool-deck-games.qa.test.ts` (33 tests, about 80 s). No engine, card or client file was touched.

## 1. Results (W = wins / games; seeds 1-12 x explore x defense modes)

| Fixture                   | Rhino (240)          | Morlock Siege (96)             | Mister Sinister (96) |
| ------------------------- | -------------------- | ------------------------------ | -------------------- |
| deadpool-pool-break-time  | 0W (231 m, 9 d)      | 0W                             | 0W                   |
| deadpool-aggression       | **5W** (219 m, 16 d) | **1W**                         | 0W                   |
| spider-man-pool           | 0W (182 m, 58 d)     | 0W                             | 0W                   |
| domino-pool               | 0W (146 m, 94 d)     | 0W (1 game never ends, see F1) | 0W                   |
| adam-warlock-pool         | 0W (168 m, 72 d)     | 0W                             | 0W                   |
| cable-leadership-live-d.  | 0W (159 m, 81 d)     | 0W                             | 0W                   |
| spider-woman-pool-justice | 0W (111 m, 129 d)    | 0W                             | 0W                   |

m = main scheme completed, d = all players defeated. Rhino: explore 0-9 x both defense modes. Others: explore 0-3 x both defense modes.

**Win rate on Rhino: 5/240 for Deadpool Aggression (the one fixture with no 'Pool card and no Dreadpool set), 0/240 for each of the other six.** That is the
driver, not the decks: the same driver wins 0/60 Rhino games with the five Core precons (Spider-Man, Captain Marvel, Iron Man, Black Panther, She-Hulk, seeds 1-12).
Reason from the logs (10 seeds each): a game lasts about 4 rounds; the main scheme (The Break-In!, target 7 per hero, acceleration 1 per hero, matches
MarvelCDB 01097) takes about 9 threat while the driver thwarts it about 1 time (Break Time deck 0.9, Aggression 1.8), 5.6 cards stay in hand unplayed, and Rhino takes
8-10 damage of 14. The driver thwarts the main scheme only when the next villain phase could complete it, which with Deadpool's THW 2 is too late. The Dreadpool set
adds side threat (4.8 vs 3.0 per game) but the Aggression deck loses the same way, so no rule looked wrong on Rhino.

## 2. Pinned games (`PINS`, 21, hero-ready unless noted)

One game per pairing with every invariant of `built-deck-games.qa.test.ts` on every command (no refusal, no soft lock, no card in two zones, unique rule, attack/scheme arithmetic,
player side scheme limit, one form change a round), replay deep-equal, game-over state, and the outcome by its rule. Two wins: Aggression / Rhino (seed 10, balanced, 10 rounds,
villain defeated at its last stage) and Aggression / Morlock Siege (seed 3, balanced, explore 2, 6 rounds, three villains under Routed). The other 19 are the shortest loss of
seeds 1-12 x explore 0-3 (2-5 rounds) so the file stays fast. `LONG_PINS` (`QA_FULL=1`) are the longest loss per pairing (9-23 rounds, 374 s): all 21 held every invariant when run once.
`POOL_SCAN=1` prints the table; `QA_FULL=1` plays seeds 1-12 of all 21 pairings with the invariants.

## 3. 'Pool behaviors proven in play (staged hand/encounter via `GameSetupConfig.stack`, every command checked, every log replayed)

- **Crisis 44037** drawn from the encounter deck (behind a filler that absorbs Rhino's boost), removed from the game; Dreadpool 44038 in play engaged with the first player;
  **Dreadful Deeds 44039** in the villain area with 2 starting threat + 2 for a player who controls a 'Pool card; with the hero passing round 1 (no 'Pool card) only the starting 2.
- **Dreadpool's When Defeated**: the hero hunts him (hit points 3), he is dealt face down to the defeating player, revealed again and engages them at 0 damage (seed 4).
- **Break Time 44046**: Alter-Ego Action played at 5 damage; prompt is `reportFact minutesAway` (whole number, no options, asked of the player); answered 3, `damageHealed` 3, damage 5 to 2; paid 3 resources (cost 3 per player x 1 player).
- **Git Gud 44028**: `outsideFacts.wonPreviousGame` absent costs 0; true costs 2 (printed cost 2, reduced by 2 only if the previous game was not won).
- **The Merc with the Mouth 44032**: asked `talkedThisPhase` (yes/no) after the player phase ends; "no" discards it (encounter discard); "yes" keeps it and asks again next phase (3 asks, seed 5).
- **Live Dangerously 44024**, by Cable (Leadership) and by Domino ('Pool): in the villain area with 3 threat, hand size +2, limit 1. Cable starts with his own player side scheme
  (40006), so playing it forces `discardOverPlayerSideSchemeLimit` (RRG 1.8 p. 34), and one remains, nothing to the victory display.
- **Adam Warlock** plays 'Pool, Justice, Leadership and Protection cards in one game.
- **Deadpool's would-be-defeated ability** (44001a) fires in real games: 81 of 240 Break Time games and 116 of 240 Aggression games at Rhino; asserted: acceleration token added, form change to alter-ego, not eliminated.
- Seen incidentally in the scans, unstaged: Dreadpool defeated in 2-10 games per 'Pool deck, Git Gud's interrupt (10 games), Git Gud played in 158 games.

## 4. Findings

- **F1 (soft lock, fixed 2026-10-07; the pin is now a plain test: the game ends, one When Defeated per defeat)**: domino-pool / Morlock Siege / seed 9 / hero-ready / explore 2 never ends (3000 commands, round 4, same prompt). Lady Deadpool 44016 ("When Defeated: Defeat a non-ELITE minion")
  under 'Pool-ized 44041 is a minion; Domino attacks and defeats her; her When Defeated resolves while she is still in play (RRG p. 48), she is the only non-ELITE minion, so she offers herself;
  choosing her defeats her again, which triggers her When Defeated again, for ever. Expected (RRG "Defeat", p. 15: a defeated card is already defeated): no second defeat, the ability ends. Fix (engine, `alreadyDefeated` in `resolve/defeat.ts`): a card already defeated cannot be defeated again and is no valid target for a defeat; 44016's script is unchanged.
- **F2 (driver, not engine)**: the stock driver never plays Break Time (its event rule skips cost over 2) nor any player side scheme (type excluded), so unstaged scans never played Live Dangerously or Break Time; the staged tests nudge both from `legalActions`.
- **F3**: Rhino is not the easiest table for this driver (0/60 Core precon games; 5/1680 games with the seven fixtures); win rates here say nothing about deck strength. A driver that thwarts earlier would be needed to rank the decks.

Coverage not claimed: two-player tables (Break Time's per-player cost at 2, other seats healing), Metacidal Tendencies, Anti-Regeneration Ray and the 'Pool-ized attach/engage paths beyond F1 were not staged.
