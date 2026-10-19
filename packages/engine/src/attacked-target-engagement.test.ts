/**
 * `characterAttacked.targetEngagedWith`: whom the attacked character was engaged with as the attack was made, read by
 * a pattern's engagement clauses (`engagedWithPlayer`, `engagedWith`) once the attack has defeated it
 * (`EffectContext.lastKnown`, `resolve/triggers.ts`). A target still in play, and every other event, read live.
 *
 * Shaped like Battle in the Bodega (60134b): "Forced Response: After a character in this play area is attacked, …".
 * Owner Q208 open, built A (docs/phase7-wave11-scenarios.md): the minion was in this play area when it was attacked,
 * so the response still comes when the attack defeated it (RRG 1.8 "Response", p. 38: a response resolves after its
 * triggering condition; the Omega Zero Tolerance ruling resolves "after … attacks and defeats an ally" after the ally
 * has left play).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playFree, playerCardIntoPlay } from "./testing/wave3.js";

const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 4 });
const hitVillain: EffectSpec = { kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 1 } };

/** "Forced Response: After a minion engaged with you is attacked, deal 1 damage to the villain." Nested in `anyOf`. */
const WATCH_A = stubAbility("watch.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: {
      on: "characterAttacked",
      targetIs: { anyOf: [{ categories: ["minion"], engagedWithPlayer: { kind: "controller" } }] },
    },
  },
  effects: [hitVillain],
});
/** The same with the top-level `engagedWith: "you"` clause. */
const WATCH_YOU_A = stubAbility("watch-you.response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "characterAttacked", targetIs: { categories: ["minion"], engagedWith: "you" } },
  },
  effects: [hitVillain],
});
/** A control on another event: "After a minion engaged with you is defeated" reads the defeated card live. */
const ENGAGED_DEFEATED: TargetQuery = { categories: ["minion"], engagedWithPlayer: { kind: "controller" } };
const DEFEATED_A = stubAbility("defeated.response", {
  trigger: { kind: "response", forced: true, on: { on: "characterDefeated", targetIs: ENGAGED_DEFEATED } },
  effects: [hitVillain],
});
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_A.ref] });
const WATCH_YOU = stubSupport({ id: "watch-you", cost: 0, abilities: [WATCH_YOU_A.ref] });
const DEFEATED = stubSupport({ id: "defeated", cost: 0, abilities: [DEFEATED_A.ref] });

/** "Hero Action (attack): Defeat each minion." (Coup de Grâce's shape): an "(attack)" ability's attack. */
const COUP_A = stubAbility("coup.action", {
  trigger: { kind: "action", form: "hero" },
  label: ["attack"],
  effects: [{ kind: "defeat", target: { kind: "each", query: { categories: ["minion"] } } }],
});
const COUP = stubEvent({ id: "coup", cost: 0, abilities: [COUP_A.ref] });

const deps: EngineDeps = depsOf(WATCH_A, WATCH_YOU_A, DEFEATED_A, COUP_A);
const ENCOUNTER: readonly CardId[] = copiesOf(THUG.id, 8);

/** P1 in hero form on the first turn, with `watcher` in play and a thug engaged (`hurt` damage on it). */
function arena(watcher: CardId, hurt = 0) {
  const base = gameAtFirstTurn({
    cards: [THUG, WATCH, WATCH_YOU, DEFEATED, COUP],
    deps,
    encounter: ENCOUNTER,
    deck: [...copiesOf(COUP.id, 2), WATCH.id, WATCH_YOU.id, DEFEATED.id],
  });
  const hero = driveSession(startSession(base), deps, [{ type: "changeForm", playerId: P1 }]).session.state;
  const watched = playerCardIntoPlay(hero, watcher);
  const thug = minionEngagedWith(watched.state, THUG.id);
  const state: GameState = {
    ...thug.state,
    instances: { ...thug.state.instances, [thug.id]: { ...mustInstance(thug.state, thug.id), damage: hurt } },
  };
  return { state, thug: thug.id, hero: mustPlayer(state, P1).identity.instanceId };
}
const basicAttack = (state: GameState, hero: InstanceId, target: InstanceId) =>
  driveSession(startSession(state), deps, [
    { type: "basicAttack", playerId: P1, attackerInstanceId: hero, targetInstanceId: target },
  ]);
const villainDamage = (state: GameState) => mustInstance(state, state.activeVillainId!).damage;
const attacked = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "characterAttacked" ? [e.event] : [],
  );

describe("characterAttacked carries the target's engagement as it was attacked", () => {
  it("a basic attack that leaves the minion in play: the event names P1, and the response hears it (live read)", () => {
    const { state, thug, hero } = arena(WATCH.id);
    const { session, events } = basicAttack(state, hero, thug);
    expect(mustInstance(session.state, thug).engagedWith).toBe(P1);
    expect(attacked(events)).toEqual([expect.objectContaining({ targetInstanceId: thug, targetEngagedWith: P1 })]);
    expect(villainDamage(session.state)).toBe(1);
  });

  it("a basic attack that defeats it: the response still hears it, through `anyOf`", () => {
    const { state, thug, hero } = arena(WATCH.id, 3);
    const { session, events } = basicAttack(state, hero, thug);
    expect(activeEncounterDeck(session.state).discard).toContain(thug);
    expect(mustInstance(session.state, thug).engagedWith, "out of play it is engaged with no one").toBeNull();
    expect(attacked(events)).toEqual([expect.objectContaining({ targetEngagedWith: P1 })]);
    expect(villainDamage(session.state)).toBe(1);
  });

  it('the top-level `engagedWith: "you"` clause reads it the same way', () => {
    const { state, thug, hero } = arena(WATCH_YOU.id, 3);
    const { session } = basicAttack(state, hero, thug);
    expect(activeEncounterDeck(session.state).discard).toContain(thug);
    expect(villainDamage(session.state)).toBe(1);
  });

  it("an '(attack)' ability that defeats it: stamped on that attack's event too, and the response hears it", () => {
    const { state, thug } = arena(WATCH.id);
    const { state: after, events } = playFree(state, deps, COUP.id);
    expect(activeEncounterDeck(after).discard).toContain(thug);
    expect(attacked(events)).toEqual([expect.objectContaining({ targetInstanceId: thug, targetEngagedWith: P1 })]);
    expect(villainDamage(after)).toBe(1);
  });

  it("other events keep live reads: 'after a minion engaged with you is defeated' does not hear the defeat", () => {
    const { state, thug, hero } = arena(DEFEATED.id, 3);
    const { session } = basicAttack(state, hero, thug);
    expect(activeEncounterDeck(session.state).discard).toContain(thug);
    expect(villainDamage(session.state)).toBe(0);
  });
});
