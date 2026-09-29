/**
 * docs/phase7-wave5.md §3.19: any number of tough status cards. Synthetic villain shaped like Armadillo (`nova` 28029:
 * "Armadillo can have any number of tough status cards").
 *
 * Sources: RRG 1.8 "Status Cards" (p. 41: one of each, unless a card says otherwise), "Tough" (a tough card prevents all
 * the damage of one event and is discarded), "Piercing" (tough status cards are discarded before damage).
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubVillain } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, playFree } from "./testing/wave3.js";

const theVillain: TargetRef = { kind: "villain" };
const ARMADILLO_DEFINITION: AbilityDefinition = {
  trigger: {
    kind: "constant",
    rules: [{ kind: "statusLimit", target: { self: true }, status: "tough", max: "unlimited" }],
  },
  effects: [],
};
const ARMADILLO_CONSTANT = stubAbility("armadillo.constant", ARMADILLO_DEFINITION);
const ARMADILLO = stubVillain({
  id: "armadillo",
  stages: [{ hp: flat(30), atk: 0, sch: 0, abilities: [ARMADILLO_CONSTANT.ref] }],
});
const PLAIN = stubVillain({ id: "plain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const TOUGHEN = event("toughen", [{ kind: "giveStatus", target: theVillain, status: "tough" }]);
const ZAP = event("zap", [{ kind: "dealDamage", target: theVillain, amount: { kind: "const", value: 2 } }]);
const PIERCE = event("pierce", [
  { kind: "attack", target: theVillain, amount: { kind: "const", value: 2 }, keywords: ["piercing"] },
]);
const EVENTS = [TOUGHEN, ZAP, PIERCE];

const deps: EngineDeps = depsOf(ARMADILLO_CONSTANT, ...EVENTS.map((e) => e.ability));

function start(villain: typeof ARMADILLO): GameState {
  const state = gameAtFirstTurn({
    cards: [ARMADILLO, PLAIN, ...EVENTS.map((e) => e.card)],
    deps,
    villain,
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 4)),
  });
  return { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}
const villainOf = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId);
const repeat = (state: GameState, card: CardId, times: number): GameState => {
  let s = state;
  for (let i = 0; i < times; i++) s = playFree(s, deps, card).state;
  return s;
};

describe("§3.19 'can have any number of tough status cards'", () => {
  it("holds three; each prevents one damage event and goes alone; replay deep-equal", () => {
    const tough = repeat(start(ARMADILLO), TOUGHEN.card.id, 3);
    expect(villainOf(tough).statuses.tough).toBe(3);
    const { state, session } = playFree(repeat(tough, ZAP.card.id, 2), deps, ZAP.card.id);
    expect(villainOf(state).statuses.tough).toBe(0);
    expect(villainOf(state).damage).toBe(0);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("piercing discards them all", () => {
    const tough = repeat(start(ARMADILLO), TOUGHEN.card.id, 3);
    const state = playFree(tough, deps, PIERCE.card.id).state;
    expect(villainOf(state).statuses.tough).toBe(0);
    expect(villainOf(state).damage).toBe(2);
  });

  it("any other villain holds one", () => {
    expect(villainOf(repeat(start(PLAIN), TOUGHEN.card.id, 3)).statuses.tough).toBe(1);
  });
});
