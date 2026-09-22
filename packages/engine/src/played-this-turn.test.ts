/**
 * docs/phase7-wave3.md §3.24: `Predicate playedThisTurn` and `GameState.playedThisTurn`. Synthetic cards shaped like
 * Gamora's Decisive Blow (`gam` 18006): "Hero Action (attack): Deal 4 damage to an enemy (7 damage instead if you have
 * played a [Thwart] event this turn)." and Set the Pace (18005), a Thwart event.
 *
 * Sources: RRG 1.8 "Player Turn" (p. 34); docs/phase7-wave2.md §13.4 (the shape, specified there).
 */

import { trait, type EventCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const theVillain: TargetRef = { kind: "villain" };
const THWART = trait("Thwart");
const ATTACK = trait("Attack");

const actionEvent = (id: string, traits: readonly (typeof THWART)[], effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  const card: EventCard = { ...stubEvent({ id, cost: 0, abilities: [ability.ref] }), traits };
  return { card, ability };
};
const DECISIVE_BLOW = actionEvent(
  "decisive-blow",
  [ATTACK],
  [
    {
      kind: "if",
      condition: {
        kind: "playedThisTurn",
        player: { kind: "controller" },
        cards: { categories: ["event"], trait: THWART },
      },
      then: [{ kind: "dealDamage", target: theVillain, amount: n(7) }],
      otherwise: [{ kind: "dealDamage", target: theVillain, amount: n(4) }],
    },
  ],
);
const SET_THE_PACE = actionEvent(
  "set-the-pace",
  [THWART],
  [{ kind: "removeThreat", target: { kind: "mainScheme" }, amount: n(1) }],
);
const EVENTS = [DECISIVE_BLOW, SET_THE_PACE];

const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

function start(): { state: GameState; blows: readonly InstanceId[]; pace: InstanceId } {
  let state = gameAtFirstTurn({
    cards: EVENTS.map((e) => e.card),
    deps,
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 3)),
  });
  const blows: InstanceId[] = [];
  for (let i = 0; i < 2; i++) {
    const given = giveCard(state, P1, DECISIVE_BLOW.card.id, blows);
    state = given.state;
    blows.push(given.id);
  }
  const pace = giveCard(state, P1, SET_THE_PACE.card.id);
  return { state: pace.state, blows, pace: pace.id };
}
const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const villainDamage = (state: GameState): number => mustInstance(state, state.villains[0]!.instanceId).damage;

describe("§3.24 'if you have played a [Thwart] event this turn'", () => {
  it("without one, the attack deals its base damage", () => {
    const { state, blows } = start();
    expect(villainDamage(driveSession(startSession(state), deps, [play(blows[0]!)]).session.state)).toBe(4);
  });

  it("after one this turn, it deals the higher amount", () => {
    const { state, blows, pace } = start();
    const { session } = driveSession(startSession(state), deps, [play(pace), play(blows[0]!)]);
    expect(villainDamage(session.state)).toBe(7);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("the record is per turn: it is empty again once the turn ends", () => {
    const { state, pace } = start();
    const { session } = driveSession(startSession(state), deps, [play(pace), { type: "endTurn", playerId: P1 }]);
    expect(session.state.playedThisTurn?.[P1] ?? []).toEqual([]);
  });
});
