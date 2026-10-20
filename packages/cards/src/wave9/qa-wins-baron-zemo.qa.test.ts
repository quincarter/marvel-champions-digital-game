/**
 * Rules QA, "can each wave 9 scenario be won": Baron Zemo (MC50 pp. 18-19; 50165a to 50183b), standard mode, three
 * players.
 *
 * No honest win was found. SEARCH (offline, not re-run here): 218 games at 1 to 4 players (the same pool, seeds 1 and
 * 2; the shared `zemoDecide` and this file's player with advance thresholds of 1 open row to "within 12 of the
 * target"): 0 wins. 189 reached the accusation and the Unmasked fight (stage 3), 130 were lost to the scheme, 52 to
 * every hero defeated and 36 to three Board Members joining; Zemo took at most 16 damage. Every game was played from
 * the printed setup with the natural shuffle by the Baron Zemo player of `qa-wins.shared.ts`: every Board Member's
 * Hero Action is used while it holds secret counters (Surveillance first: it thwarts 2), Zemo is attacked (his 12
 * fixed hit points reset and take 3 secret counters with them, 50165a), the Response (50167b) is taken whenever a
 * Board Member is empty, and the players advance to the accusation only when the evidence leaves one row (or the
 * scheme is within 8 of the target).
 *
 * Where the games end, and why (the pinned line: Iron Man, Captain Marvel, Captain America, seed 1): the table gets
 * the evidence it needs. The Response is used at the end of rounds 1, 2 and 3 (six S.H.I.E.L.D. cards faceup, so the
 * A.I.M. envelope is determined) and the accusation at the end of round 3 is exactly right: no wrong guess (50168b
 * step 2 and 3 place nothing). That is the best the rules allow, and the game is still lost in round 4: the scheme (2
 * per hero to 12 per hero, +2 per hero, 50167b) takes 6, 5 and 1 threat a round from the escalation, "Advance" and the
 * Interference cards, so the table is at 25 of 36 when the accusation is made; 3B then starts from the Board Members'
 * secret counters (1 per hero for each secret on an attachment, 50169b), Surveillance's Aid puts 2 threat on the
 * scheme for each secret placed on it (50182b) and the Unmasked Zemo (18 per hero, 54) takes only 7 damage. Secret
 * counters are the clock inside the clock: each Response places 2 on a Board Member, the Interference treacheries
 * place 1 on each, Zemo's activations place more, and a member at 4 flips to a Permanent attachment whose counters can
 * no longer be removed. Every printed number matches the scans (qa-wins-clock.qa.test.ts) and the accusation's
 * arithmetic is the printed one.
 */
import { replay } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { DEPS } from "./qa-gaps.shared.js";
import { DECKS, ledgerTable, runLine, type Line } from "./qa-wins.shared.js";

vi.setConfig({ testTimeout: 600_000 });

const LINE: Line = {
  scenario: "baron-zemo",
  team: [DECKS.ironManAggression, DECKS.captainMarvelLeadership, DECKS.captainAmericaProtection],
  seed: 1,
  policy: { margin: 6, attack: "villain", thwart: "smart" },
  zemo: { advanceRows: 1, danger: 8 },
};
let memo: ReturnType<typeof runLine> | undefined;
const played = () => (memo ??= runLine(LINE));

describe("Baron Zemo, three players, a perfect accusation and a lost fight (Iron Man + Captain Marvel + Captain America, seed 1)", () => {
  it("is lost to the main scheme in round 4, at stage 3B (50169b: 'If this stage is completed, the players lose the game')", () => {
    const run = played();
    expect(run.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
    expect(run.rounds).toBe(4);
    expect(run.session.state.mainScheme.stageIndex).toBe(2);
  });

  it("the accusation is made at the end of round 3 and is exactly right: the Chief Surveillance Officer's row, no wrong guess", () => {
    const run = played();
    let round = 0;
    const marks: string[] = [];
    for (const e of run.events) {
      if (e.type === "roundStarted") round = e.round;
      if (e.type === "accusationMade" || e.type === "villainFlipped") marks.push(`${e.type}@${round}`);
    }
    expect(marks).toEqual(["accusationMade@3", "villainFlipped@3"]);
    const accusation = (
      run.session.state as unknown as { accusation: { accused: unknown; mole: unknown; wrong: unknown[] } }
    ).accusation;
    expect(accusation.wrong).toEqual([]);
    expect(accusation.accused).toEqual(accusation.mole);
  });

  it("threat in and out per round: [round, heroes removed, villain phase placed, villain phase removed, damage to Zemo, damage to the players]", () => {
    expect(ledgerTable(played().ledger)).toEqual([
      [1, 4, 12, 0, 9, 10],
      [2, 0, 11, 0, 8, 3],
      [3, 0, 21, 0, 4, 21],
      // Round 4's 16 includes the incite 1 of the A.I.M. Interference boost card ("Resolve this card's 'When
      // Revealed' ability"; FFG ruling, September 22, 2026; owner decision 2026-10-20, spec §S7 E37). It was 15.
      [4, 0, 16, 0, 5, 0],
    ]);
  });

  it("the log replays deep-equal", () => {
    const run = played();
    const replayed = replay(run.session.log, DEPS);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
  });
});
