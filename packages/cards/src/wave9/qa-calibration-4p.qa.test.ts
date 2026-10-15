/**
 * Rules QA, calibration (4 players): the unchanged `winsDecide` against four older scenarios with She-Hulk, Iron Man,
 * Captain Marvel and Captain America (qa-calibration.qa.test.ts has the table and the reading). One game each, seed 1,
 * standard mode. Compare with the wave 9 pins at the same table (qa-wins-batroc: heroes remove 13, 6, 1, 2 threat; the
 * villain phase places 9, 10, 8, 19; the players take 4, 24, 33, 11): the older scenarios show the same near-zero threat
 * removal by the heroes and 12 to 28 damage a round to the players. 160 games of the three Core villains at this table
 * (40 each, 0 wins) are summarized in the other file.
 */
import { replay } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { DEPS } from "./qa-gaps.shared.js";
import { runCal, teamFor } from "./qa-calibration.shared.js";
import { ledgerTable } from "./qa-wins.shared.js";

vi.setConfig({ testTimeout: 600_000 });

/** `[scenario, seed, loss reason, rounds, ledger]` as in qa-calibration.qa.test.ts. */
const FOUR_PLAYERS: readonly (readonly [string, number, string, number, number[][]])[] = [
  [
    "klaw",
    1,
    "allPlayersDefeated",
    4,
    // Re-pinned 2026-10-14: She-Hulk's I Object! is no longer offered during setup (RRG 1.8 p. 4), so the game differs
    // from round 1 on.
    [
      [1, 0, 7, 0, 7, 8],
      [2, 0, 7, 0, 14, 18],
      [3, 0, 4, 0, 0, 26],
      [4, 0, 5, 0, 1, 15],
    ],
  ],
  [
    "rhino",
    1,
    "mainSchemeCompleted",
    5,
    [
      [1, 0, 6, 0, 12, 6],
      [2, 0, 5, 0, 13, 7],
      [3, 0, 7, 0, 19, 18],
      [4, 0, 9, 0, 3, 19],
      [5, 1, 7, 0, 0, 0],
    ],
  ],
  [
    "sabretooth",
    1,
    "cardAbility",
    4,
    // Re-pinned 2026-10-14, as Klaw's.
    [
      [1, 0, 4, 0, 6, 12],
      [2, 0, 5, 0, 4, 20],
      [3, 0, 5, 0, 3, 24],
      [4, 0, 14, 0, 1, 11],
    ],
  ],
  [
    "ultron",
    1,
    "mainSchemeCompleted",
    6,
    [
      [1, 0, 7, 0, 12, 11],
      [2, 2, 9, 0, 4, 28],
      [3, 0, 14, 0, 1, 13],
      [4, 0, 16, 0, 1, 12],
      [5, 0, 23, 0, 2, 9],
      [6, 0, 7, 0, 0, 0],
    ],
  ],
];

describe("calibration: the unchanged winsDecide against older scenarios, four players, standard", () => {
  for (const [scenario, seed, reason, rounds, ledger] of FOUR_PLAYERS)
    it(`${scenario}, seed ${seed}: lost to ${reason} in round ${rounds}, and the log replays deep-equal`, () => {
      const run = runCal(scenario, teamFor(4, seed), seed);
      expect(run.outcome).toMatchObject({ result: "loss", reason });
      expect(run.rounds).toBe(rounds);
      expect(ledgerTable(run.ledger)).toEqual(ledger);
      const replayed = replay(run.session.log, DEPS);
      if (!replayed.ok) throw new Error(replayed.error.message);
      expect(replayed.state).toEqual(run.session.state);
    });
});
