# Phase 7 wave 7 rules-QA: full solo games with built decks

`rules-qa-engineer`, 2026-10-06, engine at `dc26910a`. Six MarvelCDB decklists (`wave7/fixtures/decklists/`) against the five
NeXt Evolution scenarios (standard, one seat), played to an outcome by a new driver, `packages/cards/src/wave7/qa-solo-driver.ts`.
Committed test: `built-deck-games.qa.test.ts` (30 pinned games, about 60 s; `QA_FULL=1` adds seeds 1-12 for all 30 pairings,
360 games, invariants only, passed). No engine, card or client file was touched.

## 1. Results (default driver, 48 games per cell: seeds 1-12 x jitter 0-3; W = wins, m = main scheme completed, d = all players defeated, c = Hope Summers or the last Morlock lost)

| Hero     | Morlock Siege     | On the Run | Juggernaut | Mister Sinister   | Stryfe     |
| -------- | ----------------- | ---------- | ---------- | ----------------- | ---------- |
| Cable    | 0W 19m 5d 24c     | 0W 46m 2d  | 0W 45d 3c  | 0W 15m 29d 4c     | 0W 37m 11d |
| Domino   | 0W 26m 7d 15c     | 0W 48m     | 0W 45d 3c  | 0W 17m 27d 4c     | 0W 46m 2d  |
| Psylocke | 0W 19m 3d 26c (*) | 0W 41m 7d  | 0W 47d 1c  | 0W 14m 32d 2c     | 0W 29m 19d |
| Angel    | 0W 20m 1d 27c     | 0W 47m 1d  | 0W 44d 4c  | 0W 17m 24d 7c     | 0W 44m 4d  |
| X-23     | 0W 18m 11d 19c    | 0W 44m 4d  | 0W 48d     | **1W** 12m 29d 6c | 0W 26m 22d |
| Deadpool | 0W 39m 2d 7c (*)  | 0W 45m 3d  | 0W 47d 1c  | 0W 35m 9d 4c      | 0W 45m 3d  |

(*) Wins exist with the `balanced` defense mode (section 2): Psylocke 3 of 72 (seed 10, jitter 6, 7, 9), Deadpool 1 of 72
(seed 6, jitter 6). Over 10,000 games were played in all (several driver versions); 5 winning games at the final
engine (Psylocke seed 10 at three jitters, Deadpool, X-23). **No win in the other 26 pairings.** Closest losses (villain stage reached, rounds): Cable/Sinister seed 7 r10, Psylocke,
X-23 and Deadpool Morlock Siege with 2 villains routed (needed 3), Psylocke/Stryfe and Angel/Sinister at stage II, Psylocke/On the Run r8.

**Pinned (all 30 are in `PINS`; wins assert the rule and the final state):**

- Psylocke / Morlock Siege, seed 10, `balanced`, jitter 6: win in round 6 (89 commands). Routed holds Greycrow, Chimera, Arclight.
- Deadpool / Morlock Siege, seed 6, `balanced`, jitter 6: win in round 9 (143 commands). Routed holds Arclight, Blockbuster, Vertigo; the victory display holds a Morlock (Victory -1).
- X-23 / Mister Sinister, seed 2, default driver, jitter 0: win in round 8 (104 commands), Sinister stage II (the last) defeated.
- The other 27 are the quickest loss seen per pairing (rounds 1-5), pinned for regression, not as examples of play.

Win assertions: outcome `win`, game over (step `gameOver`, no prompt, `legalActions` says `gameOver`, `endTurn` refused), Hope Summers
still in play, Morlock Siege: at least 3 villains tucked under Routed (Knock, Knock 1A / Mutant Massacre 2B), otherwise every villain
defeated at its last stage (RRG 1.8 "Villain Defeat", p. 47). Every loss asserts its own rule (threat at or over the target, every
identity at its hit points, the Morlocks gone or Hope Summers out of play).

## 2. The driver in a few lines

Picks only from `legalActions` examples (rebuilt for basic thwart and attack targets) and the options of the open prompt.
Order: change form (hero when healthy, alter-ego to `basicRecover` when at half hit points or 5 or less), resource generators,
allies, supports, upgrades, events paid with at most 2 cards, abilities once a turn, thwart (main scheme when the next villain
phase could complete it, crisis or hazard side schemes, else small schemes), attack (a minion it kills; a patrol minion first when the
main scheme is the danger). Prompts: keep the hand, take every optional trigger, pay with the least valuable cards, discard the least
valuable card, put indirect damage on enemy minions or on allies before the hero, never defend with Hope Summers or a Morlock.
Options: `defense` `hero-ready` (default: a ready hero defends and stays ready when two hits from death) or `balanced` (an ally that
survives defends, a healthy hero takes the hit); `style` `rules` (default) or `lookahead` (ranks commands by a simulated board value; weaker);
`explore` n (deterministic score jitter, so one seed is many games). Games reproduce from (seed, defense, style, explore).

## 3. Findings

No defect confirmed, so no `it.fails` pin. What was checked against the log of thousands of real actions:

- Damage and threat arithmetic, now asserted on every command of every pinned game (`checkArithmetic`): `attackResolved` equals max(0, base + boost - defense), `schemeResolved` equals base + boost + bonus (about 1,000 attacks and 430 schemes held in scratch runs); minions without villainous never get a boost (RRG 1.8 "Boost", p. 11).
- Retaliate (RRG 1.8 "Retaliate X"): dealt back after a tough status absorbs the damage, not after a stunned attacker's cancelled attack, not when the target is defeated: matches the printed rule.
- Hand: after the end-of-player-phase prompt every hand is at least its hand size (143 checks); a hero that defended is still exhausted next player turn, as RRG "End of Player Phase" (ready, then the villain phase) gives. So a driver's defense is a trade, not free: `hero-ready` defends and loses the hero's next action, `balanced` keeps acting and dies sooner; neither wins reliably.
- Patrol blocks the main scheme thwart with the engine's message; Hope Summers dies to Trample in round 1 when she is the only ally (text: "attacks the ally with the fewest remaining hit points"); Mutant Massacre's action is offered with no Hide! in the discard pile (legal, does nothing).

Observations for the owner, not defects: (1) On the Run in solo is lost to threat in rounds 1 to 5 in about 94% of games, and in round 1 in about 4%
(start 1, target 8, +1 acceleration, Captor makes the villain scheme while a Marauder minion is engaged, villains deal 0-4 boost icons, patrol stops
the thwart): confirm "8 per player" against the printed 40103 card. (2) The Morlock Siege win is logged as `villainDefeated` (documented on `endGame`),
so a victory screen reading the reason should not say a villain fell. (3) Seeded wins drift: at `076e4973` X-23 also won Morlock Siege (seeds 8 and 4) and
Juggernaut (seed 9); after `dc26910a` they do not (Sinister seed 2 still wins, a round later). Expected for pins; the table row is the signal.

## 4. Unexercised

Final-stage wins in On the Run (Escaping with Hope, the Captor's reset) and Stryfe never happened in play, and Juggernaut's only at the older engine; they still rest on staged tests.
Expert and heroic modes, 2 to 4 seats, campaign, Angel's three faces beyond the first hero face (the driver takes the first form offered), reactive events outside prompts,
and any hero beating a scenario with an aspect the importer inferred differently. The driver's win rate is about 0.3 percent: it shows wins are reachable, not how often a person wins.
