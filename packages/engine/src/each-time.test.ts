/**
 * docs/phase7-wave3.md §3.17: a lasting "each time …" effect (`EffectSpec eachTimeUntil`, `LastingEffectBody eachTime`).
 * Synthetic cards shaped like Schadenfreude (`gmw` 16032): "Hero Action: Until the end of the turn, heal 2 damage from
 * Rocket Raccoon each time you deal any amount of damage to an enemy."
 *
 * Sources: RRG 1.8 "Lasting Effects" (p. 26), "Delayed Effect" (p. 15).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import type { InstanceId } from "./ids.js";
import { replay, startSession } from "./engine.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const yourIdentity: TargetRef = { kind: "identityOf", player: { kind: "controller" } };

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const SCHADENFREUDE = actionEvent("schadenfreude", [
  {
    kind: "eachTimeUntil",
    until: "endOfTurn",
    on: {
      on: "dealDamage",
      sourceIs: { controller: "you" },
      targetIs: { categories: ["enemy"] },
      requireResults: { amount: 1 },
    },
    effects: [{ kind: "heal", target: yourIdentity, amount: n(2) }],
  },
]);
const ZAP = actionEvent("zap", [{ kind: "dealDamage", target: { kind: "villain" }, amount: n(1) }]);
const EVENTS = [SCHADENFREUDE, ZAP];

const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

/** p1's first turn, their identity carrying 8 damage, with one Schadenfreude and three Zaps in hand (before the log). */
function start(): { state: GameState; cards: readonly InstanceId[] } {
  let state = gameAtFirstTurn({
    cards: EVENTS.map((e) => e.card),
    deps,
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 4)),
  });
  const identity = mustPlayer(state, P1).identity.instanceId;
  state = { ...state, instances: { ...state.instances, [identity]: { ...mustInstance(state, identity), damage: 8 } } };
  const cards: InstanceId[] = [];
  for (const card of [SCHADENFREUDE.card.id, ZAP.card.id, ZAP.card.id, ZAP.card.id]) {
    const given = giveCard(state, P1, card, cards);
    state = given.state;
    cards.push(given.id);
  }
  return { state, cards };
}
const play = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});
const identityDamage = (state: GameState): number =>
  mustInstance(state, mustPlayer(state, P1).identity.instanceId).damage;

describe("§3.17 'until the end of the turn, … each time …'", () => {
  it("resolves after every matching event while it lasts", () => {
    const { state, cards } = start();
    const [schadenfreude, zap1, zap2] = cards;
    const { session } = driveSession(startSession(state), deps, [play(schadenfreude!), play(zap1!), play(zap2!)]);
    expect(identityDamage(session.state)).toBe(8 - 2 - 2);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("does nothing before it is created", () => {
    const { state, cards } = start();
    const [, zap1] = cards;
    const { session } = driveSession(startSession(state), deps, [play(zap1!)]);
    expect(identityDamage(session.state)).toBe(8);
  });

  it("ends with the turn", () => {
    const { state, cards } = start();
    const [schadenfreude] = cards;
    const { session } = driveSession(startSession(state), deps, [
      play(schadenfreude!),
      { type: "endTurn", playerId: P1 },
    ]);
    expect(session.state.lastingEffects.some((effect) => effect.kind === "eachTime")).toBe(false);
  });
});
