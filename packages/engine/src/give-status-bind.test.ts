/**
 * docs/phase7-wave4.md §3.60: `giveStatus.bind` reports how many status cards were actually given (`<bind>.amount`,
 * summed over the targets). A character already at its capacity gets none (RRG 1.8 "Status Cards": one of each type,
 * two for steady), so "If no tough status card was given this way" (Magic Muscle, `hood` 24070) is `amount` equal to
 * 0, not "no target existed". Synthetic event shaped like it: tough to each minion, draw 1 if none was given.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubTreachery } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playFree } from "./testing/wave3.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });
const eachMinion: TargetRef = { kind: "each", query: { categories: ["minion"] } };

const BRUTE = stubMinion({ id: "brute", atk: 1, sch: 1, hp: 5, boostIcons: 0 });
const FILLER = stubTreachery({ id: "filler" });
const effects: readonly EffectSpec[] = [
  { kind: "giveStatus", target: eachMinion, status: "tough", bind: "given" },
  {
    kind: "if",
    condition: { kind: "compare", left: { kind: "var", name: "given.amount" }, op: "equalTo", right: n(0) },
    then: [{ kind: "draw", player: { kind: "controller" }, amount: n(1) }],
  },
];
const ability = stubAbility("muscle.action", { trigger: { kind: "action" }, effects });
const MUSCLE = stubEvent({ id: "muscle", cost: 0, abilities: [ability.ref] });
const deps: EngineDeps = depsOf(ability);

/** Two minions engaged with p1, with the given tough counts. */
function twoMinions(tough: readonly [number, number]): { state: GameState; ids: readonly InstanceId[] } {
  let state = gameAtFirstTurn({
    cards: [BRUTE, FILLER, MUSCLE],
    deps,
    encounter: [...copiesOf(BRUTE.id, 2), ...copiesOf(FILLER.id, 20)],
    deck: copiesOf(MUSCLE.id, 3),
  });
  const ids: InstanceId[] = [];
  for (const count of tough) {
    const engaged = minionEngagedWith(state, BRUTE.id);
    const instance = mustInstance(engaged.state, engaged.id);
    state = {
      ...engaged.state,
      instances: {
        ...engaged.state.instances,
        [engaged.id]: { ...instance, statuses: { ...instance.statuses, tough: count } },
      },
    };
    ids.push(engaged.id);
  }
  return { state, ids };
}

/** Hand size after playing Muscle, relative to before (the event itself nets 0 when handed then played). */
function playAndMeasure(state: GameState): { after: GameState; drew: number } {
  const before = mustPlayer(state, P1).hand.length;
  const after = playFree(state, deps, MUSCLE.id).state;
  return { after, drew: mustPlayer(after, P1).hand.length - before };
}

describe("§3.60 `giveStatus.bind`: how many status cards were actually given", () => {
  it("counts every target that received one (none at capacity: no fallback)", () => {
    const { state, ids } = twoMinions([0, 0]);
    const { after, drew } = playAndMeasure(state);
    expect(ids.map((id) => mustInstance(after, id).statuses.tough)).toEqual([1, 1]);
    expect(drew).toBe(0);
  });

  it("one given, one already at capacity: amount 1, no fallback", () => {
    const { state, ids } = twoMinions([1, 0]);
    const { after, drew } = playAndMeasure(state);
    expect(ids.map((id) => mustInstance(after, id).statuses.tough)).toEqual([1, 1]);
    expect(drew).toBe(0);
  });

  it("every target already at capacity: amount 0 though targets exist, so the fallback runs", () => {
    const { state, ids } = twoMinions([1, 1]);
    const { after, drew } = playAndMeasure(state);
    expect(ids.map((id) => mustInstance(after, id).statuses.tough)).toEqual([1, 1]);
    expect(drew).toBe(1);
  });
});
