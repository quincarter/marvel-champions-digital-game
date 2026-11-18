/**
 * Rules QA, "can each wave 9 scenario be won": M.O.D.O.K. (MC50 p. 13; 50103a to 50113), standard mode, four players.
 *
 * No honest win was found. SEARCH (offline, not re-run here): 70 games at 1 to 4 players (the same pool, seeds 1 and
 * 2): 0 wins. 28 were lost to the third scheme completion, 38 to every hero defeated; M.O.D.O.K. took at most 12
 * damage and no Holding Cell was ever emptied. Every game was played from the printed setup with the natural shuffle
 * by the purposeful player of `qa-wins.shared.ts` (the Alert Level's sink is not in this scenario; the Holding Cell
 * Hero Actions are left to the greedy driver, which pays for them whenever it can).
 *
 * Where the games end, and why (the pinned line: Captain Marvel, Captain America, Thor, Hulk, seed 1): the scheme is 1
 * per hero to 7 per hero (4 of 28) with +1 per hero each round, and "when this stage would be completed" it puts a
 * random set-aside Adaptoid upgrade into play instead, clears the threat and shuffles the Adaptoid minions back into
 * the encounter deck, and the players lose when no upgrade is left to put into play (50104b scan; 4 upgrades, 1 in
 * play at setup, so the THIRD completion loses). Each upgrade also buffs every Adaptoid (50109 to 50112). The table
 * cleared threat in rounds 1 to 7 as 0, 2, 7, 3, 2, 0, 1 and the villain phases put on 4, 14, 8, 19, 22, 24 and 8:
 * completions in rounds 4 and 5 (31 and 30 removed) and the loss at the third. M.O.D.O.K. (10 hit points, retaliate 1,
 * 50103a) was defeated once (-2 lock counters) and the Holding Cell's 8 lock counters (2 per hero) were never close to
 * gone: the win is "free the Inhumans, then defeat M.O.D.O.K. with no Holding Cell in play". Every printed number
 * matches the scan (qa-wins-clock.qa.test.ts).
 */
import { replay } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { DEPS } from "./qa-gaps.shared.js";
import { DECKS, ledgerTable, runLine, type Line } from "./qa-wins.shared.js";

vi.setConfig({ testTimeout: 600_000 });

const LINE: Line = {
  scenario: "modok",
  team: [DECKS.captainMarvelLeadership, DECKS.captainAmericaProtection, DECKS.thorJustice, DECKS.hulkJustice],
  seed: 1,
  policy: { margin: 4, attack: "smart", thwart: "smart" },
};
let memo: ReturnType<typeof runLine> | undefined;
const played = () => (memo ??= runLine(LINE));

describe("M.O.D.O.K., four players, a purposeful line (Captain Marvel + Captain America + Thor + Hulk, seed 1)", () => {
  it("is lost to the third scheme completion in round 7 ('if there are no set-aside Adaptoid environments, the players lose', 50104b)", () => {
    const run = played();
    expect(run.outcome).toEqual({
      result: "loss",
      reason: "cardAbility",
      sourceInstanceId: run.session.state.mainScheme.instanceId,
    });
    expect(run.rounds).toBe(7);
  });

  it("threat in and out per round: [round, heroes removed, villain phase placed, villain phase removed, damage to M.O.D.O.K., damage to the players]", () => {
    expect(ledgerTable(played().ledger)).toEqual([
      [1, 0, 4, 0, 13, 20],
      [2, 2, 14, 0, 1, 11],
      [3, 7, 8, 0, 11, 22],
      [4, 3, 19, 31, 0, 13],
      // Round 5: Thor's ally Lady Sif defeats an A.I.M. minion, so Interrogation Room (01063) no longer removes 1 threat (#817, RRG 1.8 p. 49 "You, Your").
      [5, 1, 22, 31, 0, 26],
      [6, 0, 24, 0, 0, 20],
      [7, 1, 8, 0, 0, 0],
    ]);
  });

  it("two completions (rounds 4 and 5) each remove all threat; M.O.D.O.K. was defeated once, taking 2 lock counters, and 3 came off in all of the 8", () => {
    const run = played();
    const completions = run.ledger.filter((r) => r.villainRemoved > 0).map((r) => r.round);
    expect(completions).toEqual([4, 5]);
    const removed = run.events
      .filter((e) => e.type === "counterRemoved" && e.counterType === "lock")
      .reduce((n, e) => n + (e.type === "counterRemoved" ? e.amount : 0), 0);
    expect(removed).toBe(3);
  });

  it("the log replays deep-equal", () => {
    const run = played();
    const replayed = replay(run.session.log, DEPS);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
  });
});
