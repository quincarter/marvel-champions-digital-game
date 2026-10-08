/**
 * `TargetQuery.remainingHpCompare` (docs/phase7-wave8.md §3.81): a target chosen by its remaining hit points against a
 * value. Synthetic cards shaped like "Response: After this ally enters play, defeat a minion with fewer remaining hit
 * points than this ally."
 *
 * Sources: RRG 1.8 "Hit Points" (p. 22): remaining hit points are the maximum minus the damage sustained; "Target"
 * (p. 43): an ability can only be initiated with at least one valid target.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import { cardsInPlay, matchesQuery, type EffectContext } from "./select.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubMinion, stubSupport } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playFree } from "./testing/wave3.js";

const WEAKER: TargetQuery = {
  categories: ["minion"],
  remainingHpCompare: { op: "lt", value: { kind: "remainingHp", of: { kind: "self" } } },
};
// "Forced Response: After this ally enters play, defeat a minion with fewer remaining hit points than this ally."
const CULL = stubAbility("culler.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "cardEntersPlay", selfIs: "target" } },
  effects: [
    { kind: "chooseTarget", slot: "minion", query: WEAKER, chooser: { kind: "controller" } },
    { kind: "defeat", target: { kind: "slot", slot: "minion" } },
  ],
});
const CULLER = stubAlly({ id: "culler", cost: 0, atk: 1, thw: 1, hp: 4, abilities: [CULL.ref] });
const RUNT = stubMinion({ id: "runt", atk: 1, sch: 1, hp: 3 });
const PEER = stubMinion({ id: "peer", atk: 1, sch: 1, hp: 4 });
const BRUTE = stubMinion({ id: "brute", atk: 1, sch: 1, hp: 6 });
const PROP = stubSupport({ id: "prop", cost: 0 });

const deps: EngineDeps = depsOf(CULL);

function start(...minions: readonly { readonly id: string }[]) {
  let state: GameState = gameAtFirstTurn({
    cards: [CULLER, RUNT, PEER, BRUTE, PROP],
    deps,
    encounter: [...copiesOf(TREACHERY.id, 27), RUNT.id, PEER.id, BRUTE.id],
    deck: [CULLER.id, PROP.id],
  });
  const ids: InstanceId[] = [];
  for (const minion of minions) {
    const next = minionEngagedWith(state, minion.id as never);
    state = next.state;
    ids.push(next.id);
  }
  return { state, ids };
}
const damaged = (state: GameState, id: InstanceId, damage: number): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), damage } },
});
const inPlay = (state: GameState, id: InstanceId): boolean => cardsInPlay(state).includes(id);

describe("a target query on remaining hit points", () => {
  it("fewer than the ally's 4: the 3-hit-point minion is the only target and is defeated", () => {
    const { state, ids } = start(RUNT, PEER, BRUTE);
    const after = playFree(state, deps, CULLER.id).state;
    expect(ids.map((id) => inPlay(after, id))).toEqual([false, true, true]);
  });

  it("equal is not fewer; remaining, not printed: the same minion with 1 damage is a target", () => {
    const { state, ids } = start(PEER);
    expect(inPlay(playFree(state, deps, CULLER.id).state, ids[0]!)).toBe(true);
    const hurt = damaged(state, ids[0]!, 1);
    expect(inPlay(playFree(hurt, deps, CULLER.id).state, ids[0]!)).toBe(false);
  });

  it("the value is re-read: a 6-hit-point minion with 3 damage has fewer than 4, with 2 damage it has not", () => {
    const { state, ids } = start(BRUTE);
    expect(inPlay(playFree(damaged(state, ids[0]!, 3), deps, CULLER.id).state, ids[0]!)).toBe(false);
    expect(inPlay(playFree(damaged(state, ids[0]!, 2), deps, CULLER.id).state, ids[0]!)).toBe(true);
  });

  it("a card with no hit points never matches, whatever the comparison", () => {
    const { state } = start(RUNT);
    const prop = playFree(state, deps, PROP.id);
    const propId = cardsInPlay(prop.state).find((id) => mustInstance(prop.state, id).cardId === PROP.id)!;
    const context: EffectContext = { selfInstanceId: propId, controllerId: P1, event: null, bindings: {}, deps };
    for (const op of ["lt", "le", "eq", "ge", "gt"] as const) {
      const query: TargetQuery = { remainingHpCompare: { op, value: { kind: "const", value: 0 } } };
      expect(matchesQuery(prop.state, propId, query, context)).toBe(false);
    }
  });
});
