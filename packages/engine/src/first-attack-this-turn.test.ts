/**
 * docs/phase7-wave5.md §3.12: "the first attack this turn". Synthetic cards shaped like Venom III (`sm` 27075: "Forced
 * Response: After you or an ally you control attacks and damages Venom, place 1 facedown boost card on your identity (2
 * facedown boost cards instead if this is the first attack this turn)").
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, Predicate, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubVillain } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const theVillain: TargetRef = { kind: "villain" };
const counter = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "self" },
  counterType,
  amount: n(1),
});
const retribution = (id: string, first: Predicate) =>
  stubAbility(id, {
    trigger: { kind: "response", forced: true, on: { on: "attack", selfIs: "target", requireResults: { damage: 1 } } },
    effects: [{ kind: "if", condition: first, then: [counter("first")], otherwise: [counter("later")] }],
  });
const ANY_ATTACK = retribution("any.forced-response", { kind: "firstAttackThisTurn" });
const AGAINST_ME = retribution("against.forced-response", { kind: "firstAttackThisTurn", against: { self: true } });
const VENOM_ANY = stubVillain({
  id: "venom-any",
  stages: [{ hp: flat(40), atk: 0, sch: 0, abilities: [ANY_ATTACK.ref] }],
});
const VENOM_ME = stubVillain({
  id: "venom-me",
  stages: [{ hp: flat(40), atk: 0, sch: 0, abilities: [AGAINST_ME.ref] }],
});
const THUG = stubMinion({ id: "thug", atk: 0, sch: 0, hp: 9, boostIcons: 0 });

const event = (id: string, target: TargetRef) => {
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    effects: [{ kind: "attack", target, amount: n(1) }],
  });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const HIT_VILLAIN = event("hit-villain", theVillain);
const HIT_THUG = event("hit-thug", { kind: "each", query: { categories: ["minion"] } });

const deps: EngineDeps = depsOf(ANY_ATTACK, AGAINST_ME, HIT_VILLAIN.ability, HIT_THUG.ability);

function start(villain: typeof VENOM_ANY): GameState {
  const state = gameAtFirstTurn({
    cards: [VENOM_ANY, VENOM_ME, THUG, HIT_VILLAIN.card, HIT_THUG.card],
    deps,
    villain,
    encounter: copiesOf(THUG.id, 20),
    deck: [...copiesOf(HIT_VILLAIN.card.id, 3), HIT_THUG.card.id],
  });
  return { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
}
const counters = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId).counters;

describe("§3.12 'if this is the first attack this turn'", () => {
  it("the first attack reads true, the second false; replay deep-equal", () => {
    const once = playFree(start(VENOM_ANY), deps, HIT_VILLAIN.card.id).state;
    expect(counters(once)).toMatchObject({ first: 1 });
    const { state, session } = playFree(once, deps, HIT_VILLAIN.card.id);
    expect(counters(state)).toMatchObject({ first: 1, later: 1 });
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a new turn starts the count again", () => {
    const once = playFree(start(VENOM_ANY), deps, HIT_VILLAIN.card.id).state;
    const step = once.step;
    if (step.kind !== "turn") throw new Error(step.kind);
    const nextRound = driveSession(startSession(once), deps, [{ type: "endTurn", playerId: step.activePlayerId }])
      .session.state;
    expect(nextRound.attacksThisTurn ?? []).toEqual([]);
    const hero = {
      ...nextRound,
      players: nextRound.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    };
    expect(counters(playFree(hero, deps, HIT_VILLAIN.card.id).state)).toMatchObject({ first: 2 });
  });

  it("after an attack on a minion: not the first attack, but the first against the villain", () => {
    const withThug = (v: typeof VENOM_ANY) => minionEngagedWith(start(v), THUG.id).state;
    const anyFirst = playFree(playFree(withThug(VENOM_ANY), deps, HIT_THUG.card.id).state, deps, HIT_VILLAIN.card.id);
    expect(counters(anyFirst.state)).toMatchObject({ later: 1 });
    const againstFirst = playFree(
      playFree(withThug(VENOM_ME), deps, HIT_THUG.card.id).state,
      deps,
      HIT_VILLAIN.card.id,
    );
    expect(counters(againstFirst.state)).toMatchObject({ first: 1 });
  });
});
