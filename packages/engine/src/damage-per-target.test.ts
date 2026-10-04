/**
 * A damage amount read per target (`EffectSpec dealDamage.perTarget`), the counters an effect removed recorded per card
 * (`EffectSpec removeCounters.bind`) and read back for one card (`ValueSpec var.of`). Synthetic cards shaped like Boom
 * Boom (`mut_gen` 32090): "remove all bomb counters from play and deal 2 damage to each enemy for each bomb counter
 * removed from it this way."
 *
 * Sources: ruling, June 2, 2026 (2) answer 1 (one effect's damage to several characters is dealt simultaneously); RRG
 * 1.8 "Tough" (p. 44: the status card prevents damage a character would take, so a character dealt none keeps it).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustInstance } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });
const affected: TargetRef = { kind: "slot", slot: "affected" };
const eachEnemy: TargetRef = { kind: "each", query: { categories: ["enemy"] } };
const bombed: TargetRef = { kind: "each", query: { hasCounter: "bomb" } };
const pot: TargetRef = { kind: "each", query: { categories: ["support"], name: "pot" } };

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};

/** "Remove all bomb counters from play and deal 2 damage to each enemy for each bomb counter removed from it this way." */
const DETONATE = actionEvent("detonate", [
  { kind: "removeCounters", target: bombed, counterType: "bomb", bind: "removed" },
  {
    kind: "dealDamage",
    target: eachEnemy,
    amount: { kind: "scaled", value: { kind: "var", name: "removed.amount", of: affected }, times: 2 },
    perTarget: true,
  },
  // The tally, written on the pot: how many were removed in all, and from every enemy together.
  { kind: "addCounters", target: pot, counterType: "total", amount: { kind: "var", name: "removed.amount" } },
  {
    kind: "addCounters",
    target: pot,
    counterType: "fromEnemies",
    amount: { kind: "var", name: "removed.amount", of: eachEnemy },
  },
]);
/** "Deal damage to each enemy equal to the number of bomb counters on it": a per-target amount with no bind at all. */
const SHRAPNEL = actionEvent("shrapnel", [
  {
    kind: "dealDamage",
    target: eachEnemy,
    amount: { kind: "counters", of: affected, counterType: "bomb" },
    perTarget: true,
  },
]);
/** The same amount without `perTarget`: one number for every target (nothing is bound, so it reads 0 + 1). */
const FLAT = actionEvent("flat", [{ kind: "dealDamage", target: eachEnemy, amount: n(1) }]);

/** A minion that hears its own bomb counters leave, so their removal resolves as an event. */
const HEARS = stubAbility("listener.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "countersRemoved", selfIs: "target", eventIs: { counterType: "bomb" } },
  },
  effects: [{ kind: "addCounters", target: { kind: "self" }, counterType: "heard", amount: n(1) }],
});

const POT = stubSupport({ id: "pot", cost: 0 });
const GOON = stubMinion({ id: "goon", atk: 1, sch: 1, hp: 10 });
const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 3 });
const LISTENER = stubMinion({ id: "listener", atk: 1, sch: 1, hp: 10, abilities: [HEARS.ref] });
const EVENTS = [DETONATE, SHRAPNEL, FLAT];
const deps: EngineDeps = depsOf(HEARS, ...EVENTS.map((e) => e.ability));

const patch = (state: GameState, id: InstanceId, change: Partial<GameState["instances"][string]>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...change } },
});
const villainOf = (state: GameState): InstanceId => activeVillain(state).instanceId;
const damageOf = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;
const bombsOn = (state: GameState, id: InstanceId) => mustInstance(state, id).counters.bomb ?? 0;

/** The villain (1 bomb), two goons (2 bombs, none), a listener (1 bomb) and the pot (3 bombs: not an enemy). */
function table() {
  let state = gameAtFirstTurn({
    cards: [POT, GOON, THUG, LISTENER, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [GOON.id, GOON.id, THUG.id, THUG.id, LISTENER.id, ...copiesOf(TREACHERY.id, 20)],
    deck: [POT.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  const put = (card: typeof GOON, bombs: number) => {
    const placed = minionEngagedWith(state, card.id);
    state = bombs > 0 ? patch(placed.state, placed.id, { counters: { bomb: bombs } }) : placed.state;
    return placed.id;
  };
  const two = put(GOON, 2);
  const none = put(GOON, 0);
  const listener = put(LISTENER, 1);
  const potPut = playerCardIntoPlay(state, POT.id);
  state = patch(potPut.state, potPut.id, { counters: { bomb: 3 } });
  state = patch(state, villainOf(state), { counters: { bomb: 1 } });
  return { state, two, none, listener, pot: potPut.id };
}

describe("dealDamage perTarget with removeCounters bind", () => {
  it("each enemy is dealt 2 damage for each counter removed from it; an enemy with none is dealt nothing", () => {
    const { state, two, none, listener, pot: potId } = table();
    const after = playFree(state, deps, DETONATE.card.id).state;
    expect(damageOf(after, two)).toBe(4);
    expect(damageOf(after, listener)).toBe(2);
    expect(damageOf(after, villainOf(after))).toBe(2);
    expect(damageOf(after, none)).toBe(0);
    for (const id of [two, none, listener, villainOf(after), potId]) expect(bombsOn(after, id)).toBe(0);
  });

  it("`<bind>.amount` is the total removed, a card that is not an enemy included; `var.of` sums the cards it names", () => {
    const { state, pot: potId } = table();
    const after = playFree(state, deps, DETONATE.card.id).state;
    expect(mustInstance(after, potId).counters.total).toBe(7);
    expect(mustInstance(after, potId).counters.fromEnemies).toBe(4);
  });

  it("a removal that is an event (an ability listens for it) reports its card's count as it resolves", () => {
    const { state, listener } = table();
    const after = playFree(state, deps, DETONATE.card.id).state;
    expect(mustInstance(after, listener).counters.heard).toBe(1);
    expect(damageOf(after, listener)).toBe(2);
  });

  it("an enemy owed no damage is dealt none: its tough status card stays, where a flat amount would discard it", () => {
    const { state, two, none } = table();
    const tough = patch(state, none, { statuses: { ...mustInstance(state, none).statuses, tough: 1 } });
    const after = playFree(tough, deps, DETONATE.card.id).state;
    expect(mustInstance(after, none).statuses.tough).toBe(1);
    expect(damageOf(after, two)).toBe(4);
    const flat = playFree(tough, deps, FLAT.card.id).state;
    expect(mustInstance(flat, none).statuses.tough).toBe(0);
    expect(damageOf(flat, two)).toBe(1);
  });

  it("the damage is one effect's, dealt simultaneously: every target is damaged before any is defeated", () => {
    const base = table();
    const first = minionEngagedWith(base.state, THUG.id);
    const second = minionEngagedWith(first.state, THUG.id);
    const armed = patch(patch(second.state, first.id, { counters: { bomb: 2 } }), second.id, { counters: { bomb: 2 } });
    const { state: after, events } = playFree(armed, deps, DETONATE.card.id);
    const types = events.map((event) => event.type);
    const lastDamage = types.lastIndexOf("damageDealt");
    const firstDefeat = types.indexOf("characterDefeated");
    expect(firstDefeat).toBeGreaterThan(lastDamage);
    for (const id of [first.id, second.id]) expect(after.players[0]!.playArea).not.toContain(id);
  });

  it("a per-target amount needs no bind: damage equal to the counters on each enemy, the counters left where they are", () => {
    const { state, two, none, listener } = table();
    const after = playFree(state, deps, SHRAPNEL.card.id).state;
    expect(damageOf(after, two)).toBe(2);
    expect(damageOf(after, listener)).toBe(1);
    expect(damageOf(after, villainOf(after))).toBe(1);
    expect(damageOf(after, none)).toBe(0);
    expect(bombsOn(after, two)).toBe(2);
  });
});
