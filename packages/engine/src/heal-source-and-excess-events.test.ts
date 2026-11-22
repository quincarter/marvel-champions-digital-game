/**
 * Additive, informational event fields for multiplayer achievements (issue #909, docs/multiplayer-achievements-plan.md
 * E1): `damageHealed.sourceInstanceId` names the card whose effect healed, and `damageDealt.excess` is the damage taken
 * beyond the target's remaining hit points (the overkill value, RRG 1.8 "Overkill", p. 31). Neither changes a rule:
 * every other field of those events, and every other event, stays as it was, and a replay reproduces the game.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubMinion } from "./testing/fixtures.js";
import { driveSession } from "./testing/drive.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const theAlly: TargetRef = { kind: "each", query: { categories: ["ally"] } };
const theMinion: TargetRef = { kind: "each", query: { categories: ["minion"] } };

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const MEND = actionEvent("mend", [{ kind: "heal", target: theAlly, amount: n(2) }]);
const SMASH = actionEvent("smash", [{ kind: "attack", target: theMinion, amount: n(5) }]);
const TAP = actionEvent("tap", [{ kind: "attack", target: theMinion, amount: n(2) }]);
const EVENTS = [MEND, SMASH, TAP];
const MEDIC = stubAlly({ id: "medic", cost: 0, atk: 1, thw: 1, hp: 5 });
const GOON = stubMinion({ id: "goon", atk: 1, sch: 1, hp: 3 });

const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

function start(): { state: GameState; ally: InstanceId; minion: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [MEDIC, GOON, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: copiesOf(GOON.id, 2),
    deck: [MEDIC.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const placed = playerCardIntoPlay(state, MEDIC.id);
  state = placed.state;
  state = {
    ...state,
    instances: { ...state.instances, [placed.id]: { ...mustInstance(state, placed.id), damage: 3 } },
  };
  const engaged = minionEngagedWith(state, GOON.id);
  return { state: engaged.state, ally: placed.id, minion: engaged.id };
}

/** Plays `card` for free from P1's hand and returns its instance, the events and a replay check. */
function play(state: GameState, card: (typeof EVENTS)[number]) {
  const given = giveCard(state, P1, card.card.id);
  const { session, events } = driveSession(startSession(given.state), deps, [
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
  ]);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { id: given.id, events, state: session.state };
}
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

describe("damageHealed.sourceInstanceId (#909)", () => {
  it("names the card whose effect healed, and the event has no other new field", () => {
    const { state, ally } = start();
    const after = play(state, MEND);
    expect(mustInstance(after.state, ally).damage).toBe(1);
    expect(ofType(after.events, "damageHealed")).toEqual([
      { type: "damageHealed", targetInstanceId: ally, amount: 2, sourceInstanceId: after.id },
    ]);
  });
});

describe("damageDealt.excess (#909)", () => {
  it("a lethal hit records the damage beyond the target's remaining hit points: 5 against 3 is 2", () => {
    const { state, minion } = start();
    const after = play(state, SMASH);
    const dealt = ofType(after.events, "damageDealt");
    expect(dealt).toHaveLength(1);
    expect(dealt[0]).toEqual({
      type: "damageDealt",
      targetInstanceId: minion,
      amount: 5,
      sourceInstanceId: dealt[0]!.sourceInstanceId,
      excess: 2,
    });
    // No overkill on this attack: nothing spills, though the excess is still recorded.
    expect(ofType(after.events, "overkillSpilled")).toEqual([]);
    expect(ofType(after.events, "characterDefeated").map((e) => e.instanceId)).toContain(minion);
  });

  it("a hit that leaves the target standing carries no excess field at all", () => {
    const { state, minion } = start();
    const after = play(state, TAP);
    const dealt = ofType(after.events, "damageDealt");
    expect(dealt).toHaveLength(1);
    expect(dealt[0]).not.toHaveProperty("excess");
    expect(dealt[0]).toMatchObject({ targetInstanceId: minion, amount: 2 });
  });
});
