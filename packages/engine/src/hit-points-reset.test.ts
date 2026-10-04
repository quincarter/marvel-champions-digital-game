/**
 * docs/phase7-wave6.md §3.67: "After MaGog's hit points are reset" (`TriggerEvent hitPointsReset`). Synthetic cards
 * shaped like MaGog ("When MaGog would be defeated, reset his hit points … instead") and Jolt of Adrenaline / Surge of
 * Aggression (`mojo` 39005, 39006: "Forced Response: After MaGog's hit points are reset, …"). Announced by
 * `setRemainingHitPoints` when it sets a character to its maximum hit points; a lower dial and a villain's next stage
 * are not resets.
 */

import { flat, type VillainCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustInstance, remainingHitPoints } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport, stubVillain } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
const theVillain: TargetRef = { kind: "villain" };
const n = (value: number) => ({ kind: "const", value }) as const;

/** "When MaGog would be defeated, reset his hit points instead": the dial set past the maximum, which caps it. */
const MAGOG_WOULD_FALL = stubAbility("magog.would-be-defeated", {
  trigger: { kind: "interrupt", forced: true, on: { on: "characterDefeated", selfIs: "target" } },
  effects: [{ kind: "setRemainingHitPoints", target: self, amount: n(Number.MAX_SAFE_INTEGER) }],
});
const MAGOG = stubVillain({
  id: "magog",
  stages: [{ hp: flat(8), atk: 1, sch: 1, abilities: [MAGOG_WOULD_FALL.ref] }],
});
const TWO_STAGE = stubVillain({
  id: "two-stage",
  stages: [
    { hp: flat(8), atk: 1, sch: 1 },
    { hp: flat(10), atk: 2, sch: 1 },
  ],
});

/** Jolt of Adrenaline's shape: "Forced Response: After [the villain]'s hit points are reset, place a counter here." */
const JOLT_RESPONSE = stubAbility("jolt.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "hitPointsReset", targetIs: { categories: ["villain"] } },
  },
  effects: [{ kind: "addCounters", target: self, counterType: "reset", amount: n(1) }],
});
const JOLT = stubSupport({ id: "jolt", cost: 0, abilities: [JOLT_RESPONSE.ref] });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const HIT_3 = event("hit-3", [{ kind: "dealDamage", target: theVillain, amount: n(3) }]);
const HIT_8 = event("hit-8", [{ kind: "dealDamage", target: theVillain, amount: n(8) }]);
const SET_3 = event("set-3", [{ kind: "setRemainingHitPoints", target: theVillain, amount: n(3) }]);
const SET_8 = event("set-8", [{ kind: "setRemainingHitPoints", target: theVillain, amount: n(8) }]);
const EVENTS = [HIT_3, HIT_8, SET_3, SET_8];

const deps: EngineDeps = depsOf(MAGOG_WOULD_FALL, JOLT_RESPONSE, ...EVENTS.map((e) => e.ability));

function start(villain: VillainCard, listening = true): GameState {
  const state = gameAtFirstTurn({
    deps,
    villain,
    cards: [JOLT, ...EVENTS.map((e) => e.card)],
    deck: [JOLT.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 3))],
  });
  return listening ? playerCardIntoPlay(state, JOLT.id).state : state;
}

const joltId = (state: GameState): InstanceId =>
  state.players[0]!.playArea.find((id) => mustInstance(state, id).cardId === JOLT.id)!;
const resets = (state: GameState): number => mustInstance(state, joltId(state)).counters["reset"] ?? 0;
const resetEvents = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "hitPointsReset");
const villainHp = (state: GameState): number | undefined =>
  remainingHitPoints(state, activeVillain(state).instanceId, deps);

function play(state: GameState, ...cards: readonly (typeof HIT_3)[]) {
  let result = playFree(state, deps, cards[0]!.card.id);
  for (const next of cards.slice(1)) result = playFree(result.state, deps, next.card.id);
  return result;
}

describe("§3.67 hitPointsReset", () => {
  it("MaGog's defeat replaced by a reset: the dial is full and the response resolves once", () => {
    const result = play(start(MAGOG), HIT_8);
    expect(result.state.outcome).toBeNull();
    expect(villainHp(result.state)).toBe(8);
    expect(resetEvents(result.events)).toEqual([
      expect.objectContaining({
        event: { kind: "hitPointsReset", instanceId: activeVillain(result.state).instanceId },
      }),
    ]);
    expect(resets(result.state)).toBe(1);
  });

  it("is announced after the dial is set (a response), not before", () => {
    const result = play(start(MAGOG), HIT_8);
    const setAt = result.events.findIndex((e) => e.type === "hitPointsSet");
    const resetAt = result.events.findIndex(
      (e) => e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "hitPointsReset",
    );
    expect(setAt).toBeGreaterThanOrEqual(0);
    expect(resetAt).toBeGreaterThan(setAt);
  });

  it("setting the dial below the maximum is not a reset", () => {
    const result = play(start(MAGOG), SET_3);
    expect(villainHp(result.state)).toBe(3);
    expect(resetEvents(result.events)).toEqual([]);
    expect(resets(result.state)).toBe(0);
  });

  it("setting the dial to exactly the maximum (healing every damage) is a reset", () => {
    const result = play(start(MAGOG), HIT_3, SET_8);
    expect(villainHp(result.state)).toBe(8);
    expect(resets(result.state)).toBe(1);
  });

  it("a villain's next stage is not a reset", () => {
    const result = play(start(TWO_STAGE), HIT_8);
    expect(activeVillain(result.state).stageIndex).toBe(1);
    expect(villainHp(result.state)).toBe(10);
    expect(resetEvents(result.events)).toEqual([]);
    expect(resets(result.state)).toBe(0);
  });

  it("is not pushed when nothing listens", () => {
    const result = play(start(MAGOG, false), HIT_8);
    expect(villainHp(result.state)).toBe(8);
    expect(result.events.some((e) => e.type === "triggerEvent" && e.event.kind === "hitPointsReset")).toBe(false);
  });

  it("replays to the same state", () => {
    const result = play(start(MAGOG), HIT_8);
    const replayed = replay(result.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(result.session.state);
  });
});
