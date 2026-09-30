/**
 * `view/round-debrief-trigger.ts` (guided mode G8 part 2, `docs/guided-mode.md` §4 G8): the round-boundary split
 * and the "fire once per round, never again once the run is complete" rule.
 */
import { describe, expect, test } from "vitest";
import type { GameEvent } from "@mc/engine";
import { playerId } from "@mc/engine";
import { splitAtRoundBoundary, shouldFireRoundDebrief } from "./round-debrief-trigger.js";

const P1 = playerId("p1");

const threatPlaced: GameEvent = {
  type: "threatPlaced",
  schemeInstanceId: "scheme:1" as never,
  amount: 2,
  sourceInstanceId: null,
};
const roundStarted = (round: number): GameEvent => ({ type: "roundStarted", round });
const stepChanged: GameEvent = {
  type: "stepChanged",
  from: { phase: "villain", kind: "endOfRound", delayedResolved: true },
  to: { phase: "player", kind: "turn", activePlayerId: P1, remainingPlayerIds: [] },
};

describe("splitAtRoundBoundary", () => {
  test("no roundStarted in this batch: everything carries forward, nothing finished", () => {
    const result = splitAtRoundBoundary([], [threatPlaced]);
    expect(result).toEqual({ finished: null, carried: [threatPlaced] });
  });

  test("accumulates across more than one batch before the boundary arrives", () => {
    const first = splitAtRoundBoundary([], [threatPlaced]);
    const second = splitAtRoundBoundary(first.carried, [threatPlaced]);
    expect(second).toEqual({ finished: null, carried: [threatPlaced, threatPlaced] });
  });

  test("splits at roundStarted: the finished round is round - 1, and everything before it (in this batch and the carried events) is folded in", () => {
    const carried = [threatPlaced];
    const result = splitAtRoundBoundary(carried, [threatPlaced, roundStarted(2), stepChanged]);
    expect(result.finished).toEqual({ round: 1, events: [threatPlaced, threatPlaced] });
    expect(result.carried).toEqual([roundStarted(2), stepChanged]);
  });

  test("roundStarted as the very first event in the batch: nothing from this batch joins the finished round", () => {
    const result = splitAtRoundBoundary([threatPlaced], [roundStarted(3), stepChanged]);
    expect(result.finished).toEqual({ round: 2, events: [threatPlaced] });
    expect(result.carried).toEqual([roundStarted(3), stepChanged]);
  });

  test("round 1's own opening roundStarted (game setup) never finishes a round", () => {
    const result = splitAtRoundBoundary([], [roundStarted(1), stepChanged]);
    expect(result.finished).toBeNull();
    expect(result.carried).toEqual([roundStarted(1), stepChanged]);
  });
});

describe("shouldFireRoundDebrief", () => {
  test("fires every round while any lesson is still open", () => {
    expect(shouldFireRoundDebrief(3, 5, false)).toBe(true);
  });

  test("fires the first round every lesson is done", () => {
    expect(shouldFireRoundDebrief(5, 5, false)).toBe(true);
  });

  test("never fires again once the complete debrief already fired", () => {
    expect(shouldFireRoundDebrief(5, 5, true)).toBe(false);
  });
});
