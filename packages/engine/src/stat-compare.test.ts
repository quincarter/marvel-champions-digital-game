/**
 * `TargetQuery.statCompare`: a card's current (or printed) stat compared with a value re-read every check. "Choose an
 * enemy whose SCH is less than Mirage's THW" (Mirage, `storm` 36015). Stub cards only.
 *
 * Sources: RRG 1.8 "Dash (Value)" (p. 15: a dash referenced by an ability is an unmodifiable 0), "Printed" (p. 35).
 */
import { describe, expect, it } from "vitest";
import type { InstanceId } from "./ids.js";
import { matchesQuery, type EffectContext } from "./select.js";
import type { StatComparison, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf } from "./testing/abilities.js";
import { stubAlly, stubMinion, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const deps = depsOf();
const SEER = stubAlly({ id: "seer", cost: 2, atk: 1, thw: 2, hp: 3 });
const LOW = stubMinion({ id: "low", atk: 1, sch: 1, hp: 3 });
const EVEN = stubMinion({ id: "even", atk: 1, sch: 2, hp: 3 });
const DASH = stubMinion({ id: "dash", atk: 1, sch: null, hp: 3 });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

function setup(): { state: GameState; seer: InstanceId; low: InstanceId; even: InstanceId; dash: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [SEER, LOW, EVEN, DASH, FILLER],
    deps,
    deck: [SEER.id],
    encounter: [LOW.id, EVEN.id, DASH.id, ...copiesOf(FILLER.id, 20)],
  });
  const seer = playerCardIntoPlay(base, SEER.id);
  const low = minionEngagedWith(seer.state, LOW.id);
  const even = minionEngagedWith(low.state, EVEN.id);
  const dash = minionEngagedWith(even.state, DASH.id);
  return { state: dash.state, seer: seer.id, low: low.id, even: even.id, dash: dash.id };
}

const contextFor = (self: InstanceId): EffectContext => ({
  selfInstanceId: self,
  controllerId: P1,
  event: null,
  bindings: {},
  deps,
});

const schAgainstSeerThw = (op: StatComparison["op"]): TargetQuery => ({
  categories: ["minion"],
  statCompare: { stat: "sch", op, value: { kind: "stat", of: { kind: "self" }, stat: "thw" } },
});

describe("`TargetQuery.statCompare`", () => {
  it("'SCH less than this card's THW' matches only the enemies below it", () => {
    const { state, seer, low, even } = setup();
    const query = schAgainstSeerThw("lt");
    expect(matchesQuery(state, low, query, contextFor(seer))).toBe(true);
    expect(matchesQuery(state, even, query, contextFor(seer))).toBe(false);
  });

  it("each operator compares as written", () => {
    const { state, seer, low, even } = setup();
    const at = (op: StatComparison["op"], id: InstanceId) =>
      matchesQuery(state, id, schAgainstSeerThw(op), contextFor(seer));
    expect([at("le", low), at("le", even)]).toEqual([true, true]);
    expect([at("eq", low), at("eq", even)]).toEqual([false, true]);
    expect([at("ge", low), at("ge", even)]).toEqual([false, true]);
    expect([at("gt", low), at("gt", even)]).toEqual([false, false]);
  });

  it("compares with any value, here a constant", () => {
    const { state, seer, even } = setup();
    const below = (value: number): TargetQuery => ({
      statCompare: { stat: "sch", op: "lt", value: { kind: "const", value } },
    });
    expect(matchesQuery(state, even, below(2), contextFor(seer))).toBe(false);
    expect(matchesQuery(state, even, below(3), contextFor(seer))).toBe(true);
  });

  it("a dash reads as 0 (RRG 1.8 'Dash (Value)', p. 15); a card with no stats never matches", () => {
    const { state, seer, dash } = setup();
    expect(matchesQuery(state, dash, schAgainstSeerThw("lt"), contextFor(seer))).toBe(true);
    expect(matchesQuery(state, dash, schAgainstSeerThw("eq"), contextFor(seer))).toBe(false);
    const main = state.mainScheme!.instanceId;
    const any: TargetQuery = { statCompare: { stat: "sch", op: "ge", value: { kind: "const", value: 0 } } };
    expect(matchesQuery(state, main, any, contextFor(seer))).toBe(false);
  });

  it("`printed` reads the printed stat", () => {
    const { state, seer, low } = setup();
    const printed: TargetQuery = {
      statCompare: { stat: "sch", op: "eq", value: { kind: "const", value: 1 }, printed: true },
    };
    expect(matchesQuery(state, low, printed, contextFor(seer))).toBe(true);
  });
});
