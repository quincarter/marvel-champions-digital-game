/**
 * docs/phase7-wave3.md §3.12: a tough status card resolves before every other interrupt to the damage it prevents, so a
 * "When X would take any amount of damage" interrupt never sees damage a tough card stops. The Galaxy's Most Wanted FAQ
 * (MC16 p. 21) on Groot's Flora Colossus: "the tough status card will prevent the damage before Groot's Flora Colossus
 * ability is able to trigger". Here the tough card is on the villain and a support listens for its damage.
 *
 * Sources: RRG 1.8 Appendix III "Simultaneous Timing Priority", "Status Cards" (p. 42), "Tough" (p. 45), "Piercing"
 * (p. 32), "Would" (p. 48); General FAQ (RRG 1.8 p. 58).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const theVillain: TargetRef = { kind: "villain" };

/** Flora Colossus's shape: "When [the villain] would take any amount of damage, prevent 1 of that damage", counted. */
const WATCH = stubAbility("watch.interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "dealDamage", targetIs: { categories: ["villain"] } } },
  effects: [
    { kind: "addCounters", target: { kind: "self" }, counterType: "saw", amount: n(1) },
    { kind: "preventDamage", amount: n(1) },
  ],
});
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [WATCH.ref] });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const TOUGHEN = actionEvent("toughen", [{ kind: "giveStatus", target: theVillain, status: "tough" }]);
const ZAP = actionEvent("zap", [{ kind: "dealDamage", target: theVillain, amount: n(3) }]);
const PIERCE = actionEvent("pierce", [{ kind: "attack", target: theVillain, amount: n(3), keywords: ["piercing"] }]);
const EVENTS = [TOUGHEN, ZAP, PIERCE];

const deps: EngineDeps = depsOf(WATCH, ...EVENTS.map((e) => e.ability));
const CARDS = [WATCHER, ...EVENTS.map((e) => e.card)];

/** p1 in hero form with the watcher in play; the villain tough when `tough`. */
function start(tough: boolean): { state: GameState; watcher: InstanceId } {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: [WATCHER.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
  });
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const placed = playerCardIntoPlay(heroes, WATCHER.id);
  const state = tough ? playFree(placed.state, deps, TOUGHEN.card.id).state : placed.state;
  return { state, watcher: placed.id };
}
const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;

describe("§3.12 a tough status resolves before other interrupts", () => {
  it("with no tough status, the 'would take damage' interrupt resolves (and prevents 1)", () => {
    const { state, watcher } = start(false);
    const after = playFree(state, deps, ZAP.card.id).state;
    expect(mustInstance(after, watcher).counters["saw"]).toBe(1);
    expect(mustInstance(after, villainOf(after)).damage).toBe(2);
  });

  it("with a tough status, the tough card prevents it all and the interrupt never triggers", () => {
    const { state, watcher } = start(true);
    const { state: after, events } = playFree(state, deps, ZAP.card.id);
    expect(mustInstance(after, watcher).counters["saw"]).toBeUndefined();
    expect(mustInstance(after, villainOf(after)).statuses.tough).toBe(0);
    expect(mustInstance(after, villainOf(after)).damage).toBe(0);
    expect(events).toContainEqual(expect.objectContaining({ type: "interruptsPreempted", reason: "tough" }));
  });

  it("a piercing attack discards the tough card first, so the interrupt does trigger", () => {
    const { state, watcher } = start(true);
    const after = playFree(state, deps, PIERCE.card.id).state;
    expect(mustInstance(after, watcher).counters["saw"]).toBe(1);
    expect(mustInstance(after, villainOf(after)).damage).toBe(2);
  });

  it("replays to the same state", () => {
    const { state } = start(true);
    const { session } = playFree(state, deps, ZAP.card.id);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
    expect(mustPlayer(session.state, P1).eliminated).toBe(false);
  });
});
