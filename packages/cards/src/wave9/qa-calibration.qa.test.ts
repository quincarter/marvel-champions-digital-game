/**
 * Rules QA, calibration of the wave 9 "can each scenario be won" search (docs/local-ai-plan.md line 30: "about 830 purposeful
 * wave 9 games produced 0 wins"). Question: is the player at fault, or is the wave harsher than the paper game?
 *
 * ANSWER, from evidence: the player. The same `winsDecide` (qa-wins.shared.ts, imported unchanged; margin 6, smart targets),
 * with the same MarvelCDB decklists and the same seeds, wins NONE of the older scenarios either.
 *
 * CALIBRATION (offline searches, not re-run here; every game from the printed setup, standard mode, natural shuffle):
 *
 *   unchanged `winsDecide`, 40 games per cell (seeds 1 to 40; one hero rotating through six decklists, then She-Hulk,
 *   Iron Man, Captain Marvel, Captain America in that order for 2 to 4 players), average rounds before the loss:
 *
 *     scenario   1 player      2 players     3 players     4 players
 *     Rhino      0/40  6.2     0/40  5.0     0/40  5.2     0/40  5.4
 *     Klaw       0/40  5.3     0/40  5.0     0/40  5.5     0/40  6.0
 *     Ultron     0/40  5.1     0/40  4.9     0/40  5.4     0/40  5.3
 *
 *   480 games, 0 wins. The losses are the scheme completing (Rhino 4 players: 40 of 40) or every hero defeated; the
 *   heroes remove 0 to 0.8 threat a round and the villain phase puts back 1.8 (Rhino, 1 player) to 13.8 (Ultron, 4 players).
 *
 *   Defend-preview player (a hero defends only when the engine's own `defendPreview` says the damage saved is worth the
 *   next turn's action; thwart once the scheme holds 30% of its target), 1 player, 16 games per scenario, seeds 1 to 16
 *   (24 for Juggernaut, Stryfe): average rounds before the loss, 0 wins in every row:
 *
 *     older: Rhino 5.1, Klaw 5.3, Ultron 5.3, Sabretooth 3.0, Juggernaut 3.4, Stryfe 3.7, Unus 4.3, Dark Beast 4.1,
 *            The Hood 5.1, Mysterio 5.8, Kang 4.1, Taskmaster 5.0, Hela 6.8, Zola 4.3
 *     wave 9: Black Widow 4.9, Batroc 4.6, M.O.D.O.K. 5.3, Thunderbolts 3.9, God of Lies 5.6, Enchantress 4.8
 *             (Baron Zemo 1.1: this generic player never clears a Board Member, so three join in round 1; its own player,
 *              `zemoWinsDecide`, is the one qa-wins-baron-zemo uses)
 *
 *   Other attempts at a winning player, all 0 wins: the printed starter decks of five Core heroes against Rhino, solo, plain
 *   and defend-preview (200 games); defend weights, thwart shares and a never-flip-to-alter-ego rule swept against Rhino
 *   (about 500 games); a one-step lookahead player that tries every legal command on a copy of the table and keeps the best
 *   (36 games). About 1,600 games in this pass and about 830 before it: no win in any box.
 *
 *   The repository's own greedy-driver soaks say the same without recording it: `playable/random-decks.test.ts` asserts only
 *   "reaches an outcome or the round cap, replays deep-equal" and `testing/modular-soak.ts` counts outcomes by reason
 *   (its Sabretooth losses by his own card ability are the same ones seen here); neither tallies wins. Eight earlier QA
 *   reports record that the greedy driver never wins unaided (docs/phase7-wave3-qa.md line 45, wave5-qa-sm-scenarios-1.md
 *   line 67, wave6-qa-colossus-shadowcat.md line 54, wave6-qa-mojo.md line 31, wave7-qa-cable-domino.md line 110, among them).
 *
 * WHY THE PLAYER LOSES EVERYWHERE (read from the ledgers below): a hero that defends is exhausted for its next turn,
 * because cards ready only at the end of the player phase and defending exhausts the defender (RRG 1.8 "Player Phase",
 * p. 34; "Defend, Defense", p. 16; the engine does this correctly). `winsDecide` defends every attack aimed at a hero in hero form, so
 * the heroes act on about one turn in two, remove 0 to 2 threat a round and deal 0 to 4 damage to the villain (the
 * pinned ledgers: rhino seed 3 deals 5 damage in round 1 and 0 in rounds 2 to 6). Four heroes take 13 to 28 damage a round
 * from Rhino, Klaw and Ultron alike. The defend-preview player lifts the heroes' output a little (about 2.5 damage a round
 * solo) and still loses; this repository has no player that wins a Core scenario, so the 0 of 830 in wave 9 says nothing
 * about wave 9.
 *
 * IS THE WAVE HARSHER IN KIND? No. Per round the wave 9 villain phases do what the older ones do, to the rule
 * (qa-calibration-villain-phase.qa.test.ts: 60 assertions over twelve scenarios, step 1 threat, one villain activation per
 * player, engaged minions once, boost cards for the villain and villainous minions only, damage dealt once), and the
 * pinned 4-player ledgers of the older scenarios (qa-calibration-4p.qa.test.ts) sit in the same range as Batroc's
 * (qa-wins-batroc: heroes remove 13, 6, 1, 2; the villain phase places 9, 10, 8, 19; the players take 4, 24, 33, 11).
 * Per player per round, read off the first three villain phases of two-player games (6 games each, the defend-preview
 * player; wave 9 rows divide by three rounds even when a game ended sooner, so they are if anything low): villain and minion
 * activations against a player 1.1 to 1.9 for the older scenarios (Rhino 1.1, Klaw 1.9, Ultron 1.6, Kang 1.2, The Hood 1.6)
 * and 1.4 to 2.3 for wave 9 (Batroc 1.4, Black Widow 1.6, Thunderbolts 1.9, M.O.D.O.K. 2.3), damage dealt by those attacks
 * 2.8 to 3.4 against 2.8 to 3.8. A difference of degree that the printed minions account for (Black Widow, Batroc,
 * M.O.D.O.K. and Thunderbolts put minions into play from the first villain phase), not of kind and not a defect.
 *
 * WHAT REMAINS UNKNOWN: whether any player wins a scenario of any box. A player that wins Rhino and Klaw (the user's bar:
 * "a competent solo player beats standard Rhino most of the time") was not found in this pass; the missing piece is a
 * player that plans turns, not a rule. Until one exists no win-rate comparison between boxes is possible.
 */
import { replay } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { DEPS } from "./qa-gaps.shared.js";
import { runCal, teamFor } from "./qa-calibration.shared.js";
import { ledgerTable } from "./qa-wins.shared.js";

vi.setConfig({ testTimeout: 600_000 });

/**
 * `[scenario, seed, loss reason, rounds, ledger]`, the ledger as `ledgerTable` gives it: `[round, threat removed by the heroes,
 * threat placed in the villain phase, threat removed in the villain phase, damage to the villain, damage to the players]`.
 * One hero (the decklist `teamFor(1, seed)` picks: seed 1 Iron Man, seed 2 Captain Marvel, seed 3 Captain America).
 */
const ONE_PLAYER: readonly (readonly [string, number, string, number, number[][]])[] = [
  [
    "rhino",
    1,
    "mainSchemeCompleted",
    4,
    [
      [1, 0, 1, 0, 1, 5],
      [2, 1, 1, 0, 4, 2],
      [3, 1, 2, 0, 0, 8],
      [4, 1, 7, 0, 0, 0],
    ],
  ],
  [
    "rhino",
    2,
    "mainSchemeCompleted",
    7,
    [
      [1, 0, 1, 0, 4, 5],
      [2, 1, 1, 0, 0, 2],
      [3, 1, 1, 0, 0, 4],
      [4, 1, 1, 0, 1, 5],
      [5, 1, 1, 0, 0, 4],
      [6, 1, 4, 0, 0, 2],
      [7, 0, 4, 0, 0, 0],
    ],
  ],
  [
    "rhino",
    3,
    "mainSchemeCompleted",
    6,
    [
      [1, 0, 1, 0, 5, 0],
      [2, 1, 1, 0, 0, 1],
      [3, 0, 1, 0, 0, 4],
      [4, 2, 1, 0, 0, 4],
      [5, 1, 4, 0, 0, 5],
      [6, 0, 5, 0, 0, 1],
    ],
  ],
  [
    "klaw",
    1,
    "mainSchemeCompleted",
    6,
    [
      [1, 0, 1, 0, 0, 3],
      [2, 1, 1, 0, 0, 1],
      [3, 1, 2, 0, 0, 6],
      [4, 1, 1, 0, 0, 4],
      [5, 1, 7, 0, 0, 0],
      [6, 0, 6, 0, 0, 0],
    ],
  ],
  [
    "klaw",
    2,
    "mainSchemeCompleted",
    6,
    [
      [1, 0, 1, 0, 1, 3],
      [2, 0, 1, 0, 0, 3],
      [3, 2, 1, 0, 0, 7],
      [4, 0, 8, 0, 0, 0],
      [5, 2, 1, 0, 0, 7],
      [6, 0, 6, 0, 0, 0],
    ],
  ],
  [
    "klaw",
    3,
    "mainSchemeCompleted",
    6,
    [
      [1, 0, 1, 0, 0, 0],
      [2, 1, 1, 0, 2, 0],
      [3, 0, 2, 0, 1, 6],
      [4, 3, 2, 0, 0, 3],
      [5, 2, 8, 0, 0, 0],
      [6, 1, 7, 0, 0, 0],
    ],
  ],
  [
    "ultron",
    1,
    "allPlayersDefeated",
    3,
    [
      [1, 0, 2, 0, 0, 2],
      [2, 0, 4, 0, 0, 5],
      [3, 0, 4, 0, 0, 6],
    ],
  ],
  [
    "ultron",
    2,
    "mainSchemeCompleted",
    6,
    [
      [1, 0, 2, 0, 6, 4],
      [2, 2, 3, 0, 2, 6],
      [3, 0, 5, 0, 5, 4],
      [4, 2, 4, 0, 0, 3],
      [5, 0, 7, 0, 0, 0],
      [6, 0, 1, 0, 0, 0],
    ],
  ],
  [
    "ultron",
    3,
    "mainSchemeCompleted",
    5,
    [
      [1, 0, 2, 0, 1, 2],
      [2, 2, 2, 0, 1, 4],
      [3, 0, 5, 0, 2, 4],
      [4, 0, 5, 0, 0, 3],
      [5, 0, 7, 0, 6, 0],
    ],
  ],
  [
    "sabretooth",
    1,
    "allPlayersDefeated",
    3,
    [
      [1, 0, 1, 0, 0, 4],
      [2, 0, 4, 0, 4, 7],
      [3, 0, 2, 0, 0, 9],
    ],
  ],
  [
    "sabretooth",
    2,
    "cardAbility",
    6,
    [
      [1, 0, 2, 0, 1, 5],
      [2, 0, 1, 0, 0, 4],
      [3, 0, 2, 0, 4, 3],
      [4, 2, 2, 0, 0, 3],
      [5, 0, 2, 0, 0, 4],
      [6, 0, 6, 0, 0, 0],
    ],
  ],
  [
    "sabretooth",
    3,
    "cardAbility",
    5,
    [
      [1, 0, 1, 0, 3, 2],
      [2, 0, 1, 0, 0, 1],
      [3, 0, 1, 0, 0, 0],
      [4, 0, 1, 0, 0, 4],
      [5, 0, 1, 0, 2, 7],
    ],
  ],
];

describe("calibration: the unchanged winsDecide against older scenarios, one player, standard (0 wins in 480 games over the three Core villains; these are seeds 1 to 3)", () => {
  for (const [scenario, seed, reason, rounds, ledger] of ONE_PLAYER)
    it(`${scenario}, seed ${seed}: lost to ${reason} in round ${rounds}`, () => {
      const run = runCal(scenario, teamFor(1, seed), seed);
      expect(run.outcome).toMatchObject({ result: "loss", reason });
      expect(run.rounds).toBe(rounds);
      expect(ledgerTable(run.ledger)).toEqual(ledger);
    });

  for (const scenario of ["rhino", "klaw", "ultron", "sabretooth"])
    it(`${scenario}, seed 1: the log replays deep-equal`, () => {
      const run = runCal(scenario, teamFor(1, 1), 1);
      const replayed = replay(run.session.log, DEPS);
      if (!replayed.ok) throw new Error(replayed.error.message);
      expect(replayed.state).toEqual(run.session.state);
    });
});
