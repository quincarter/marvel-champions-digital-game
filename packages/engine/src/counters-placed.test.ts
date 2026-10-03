/**
 * docs/phase7-wave6.md §3.2: "After you place a [type] counter" (`countersPlaced`). Synthetic cards shaped like Asteroid M
 * (`mut_gen` 32141b, errata RRG 1.8 p. 68: "Forced Response: After you place a magnet counter on this scheme, if there
 * are at least 3 magnet counters here, remove 3 of them and …") and Phoenix Force (`phoenix` 34002b, "After a power
 * counter is placed here"). §4.1 Q8: one event per placement, with the number placed, so six placed at once is checked
 * once and leaves three.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMainScheme, stubSupport } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";
import type { TriggerEvent } from "./trigger-events.js";

const self: TargetRef = { kind: "self" };
const tracker: TargetRef = { kind: "each", query: { categories: ["support"], name: "tracker" } };
const phoenixRef: TargetRef = { kind: "each", query: { categories: ["support"], name: "phoenix" } };
const add = (target: TargetRef, counterType: string, amount: number): EffectSpec => ({
  kind: "addCounters",
  target,
  counterType,
  amount: { kind: "const", value: amount },
});

// Asteroid M's shape: checked once per placement; "fired" counts the checks that passed, "seen" sums the amounts heard.
const MAGNET_RESPONSE = stubAbility("asteroid.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "countersPlaced", selfIs: "target", eventIs: { counterType: "magnet" } },
  },
  effects: [
    { kind: "addCounters", target: tracker, counterType: "seen", amount: { kind: "eventAmount" } },
    {
      kind: "if",
      condition: {
        kind: "compare",
        left: { kind: "counters", of: self, counterType: "magnet" },
        op: "atLeast",
        right: { kind: "const", value: 3 },
      },
      then: [
        { kind: "removeCounters", target: self, counterType: "magnet", amount: { kind: "const", value: 3 } },
        add(tracker, "fired", 1),
      ],
    },
  ],
});
const ASTEROID = stubMainScheme({
  id: "asteroid",
  stages: [
    { startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), abilities: [MAGNET_RESPONSE.ref] },
  ],
});

// Phoenix Force's shape: "After a power counter is placed here" on a player card.
const POWER_RESPONSE = stubAbility("phoenix.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "countersPlaced", selfIs: "target", eventIs: { counterType: "power" } },
  },
  effects: [add(tracker, "power-heard", 1)],
});
const PHOENIX = stubSupport({ id: "phoenix", cost: 0, abilities: [POWER_RESPONSE.ref] });
// "After you place a magnet counter" on any card, by this card's controller: the player subject is the placer.
const YOU_RESPONSE = stubAbility("tracker.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "countersPlaced", playerIs: "controller", eventIs: { counterType: "magnet" } },
  },
  effects: [add(tracker, "you-placed", 1)],
});
const TRACKER = stubSupport({ id: "tracker", cost: 0, abilities: [YOU_RESPONSE.ref] });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const SIX = event("six-magnets", [add({ kind: "mainScheme" }, "magnet", 6)]);
const ONE = event("one-magnet", [add({ kind: "mainScheme" }, "magnet", 1)]);
const TWO = event("two-magnets", [add({ kind: "mainScheme" }, "magnet", 2)]);
const OTHER = event("other-counter", [add({ kind: "mainScheme" }, "iron", 4)]);
const POWER = event("power", [add(phoenixRef, "power", 2)]);
const MAGNET_ON_PHOENIX = event("magnet-on-phoenix", [add(phoenixRef, "magnet", 1)]);
const TO_SCHEME = event("phoenix-to-scheme", [
  { kind: "moveCounters", from: phoenixRef, to: { kind: "mainScheme" }, counterType: "magnet" },
]);
const EVENTS = [SIX, ONE, TWO, OTHER, POWER, MAGNET_ON_PHOENIX, TO_SCHEME];

const deps: EngineDeps = depsOf(MAGNET_RESPONSE, POWER_RESPONSE, YOU_RESPONSE, ...EVENTS.map((e) => e.ability));

function start(): GameState {
  const state = gameAtFirstTurn({
    deps,
    mainScheme: ASTEROID,
    cards: [TRACKER, PHOENIX, ...EVENTS.map((e) => e.card)],
    deck: [TRACKER.id, PHOENIX.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 4))],
  });
  const withTracker = playerCardIntoPlay(state, TRACKER.id).state;
  return playerCardIntoPlay(withTracker, PHOENIX.id).state;
}

const supportId = (state: GameState, name: string): InstanceId =>
  state.players[0]!.playArea.find((id) => mustInstance(state, id).cardId === name)!;
const counter = (state: GameState, id: InstanceId, type: string): number => mustInstance(state, id).counters[type] ?? 0;
const tracked = (state: GameState, type: string): number => counter(state, supportId(state, TRACKER.id), type);
const magnets = (state: GameState): number => counter(state, state.mainScheme.instanceId, "magnet");
const placedEvents = (events: readonly GameEvent[]): readonly TriggerEvent[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "countersPlaced" ? [e.event] : [],
  );

function expectReplays(result: ReturnType<typeof playFree>): void {
  const replayed = replay(result.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.session.state);
}

describe("§3.2 countersPlaced", () => {
  it("placing N counters is one event with amount N and the placer", () => {
    const result = playFree(start(), deps, SIX.card.id);
    expect(placedEvents(result.events)).toEqual([
      {
        kind: "countersPlaced",
        targetInstanceId: result.state.mainScheme.instanceId,
        counterType: "magnet",
        amount: 6,
        playerId: P1,
      },
    ]);
    expect(tracked(result.state, "seen")).toBe(6);
    expect(tracked(result.state, "you-placed")).toBe(1);
    expectReplays(result);
  });

  it("Asteroid M's shape: six placed at once is checked once and leaves three (Q8)", () => {
    const result = playFree(start(), deps, SIX.card.id);
    expect(magnets(result.state)).toBe(3);
    expect(tracked(result.state, "fired")).toBe(1);
    // The next placement checks again: 3 + 1 = 4 ≥ 3, remove 3, leaving 1.
    const next = playFree(result.state, deps, ONE.card.id);
    expect(magnets(next.state)).toBe(1);
    expect(tracked(next.state, "fired")).toBe(2);
    expect(tracked(next.state, "seen")).toBe(7);
    expectReplays(next);
  });

  it("fires once per placement and only at the threshold", () => {
    const first = playFree(start(), deps, TWO.card.id).state;
    expect(magnets(first)).toBe(2);
    expect(tracked(first, "fired")).toBe(0);
    const second = playFree(first, deps, ONE.card.id).state;
    expect(magnets(second)).toBe(0);
    expect(tracked(second, "fired")).toBe(1);
    expect(tracked(second, "seen")).toBe(3);
    expect(tracked(second, "you-placed")).toBe(2);
  });

  it("other counter types do not trigger it, and no listener means no event", () => {
    const result = playFree(start(), deps, OTHER.card.id);
    expect(counter(result.state, result.state.mainScheme.instanceId, "iron")).toBe(4);
    expect(placedEvents(result.events)).toEqual([]);
    expect(tracked(result.state, "seen")).toBe(0);
    expect(tracked(result.state, "power-heard")).toBe(0);
  });

  it("is filtered by target: a magnet counter on another card is not 'on this scheme'", () => {
    const result = playFree(start(), deps, MAGNET_ON_PHOENIX.card.id);
    expect(counter(result.state, supportId(result.state, PHOENIX.id), "magnet")).toBe(1);
    expect(tracked(result.state, "seen")).toBe(0);
    // "After you place a magnet counter" with no target still hears it.
    expect(tracked(result.state, "you-placed")).toBe(1);
  });

  it("Phoenix Force's shape: 'After a power counter is placed here', once for 2 placed", () => {
    const result = playFree(start(), deps, POWER.card.id);
    expect(counter(result.state, supportId(result.state, PHOENIX.id), "power")).toBe(2);
    expect(tracked(result.state, "power-heard")).toBe(1);
    expect(tracked(result.state, "you-placed")).toBe(0);
    expectReplays(result);
  });

  it("counters moved onto a card are placed there", () => {
    const withMagnets = playFree(start(), deps, MAGNET_ON_PHOENIX.card.id).state;
    const twice = playFree(withMagnets, deps, MAGNET_ON_PHOENIX.card.id).state;
    const twiceMore = playFree(twice, deps, MAGNET_ON_PHOENIX.card.id).state;
    const result = playFree(twiceMore, deps, TO_SCHEME.card.id);
    expect(placedEvents(result.events)).toEqual([
      {
        kind: "countersPlaced",
        targetInstanceId: result.state.mainScheme.instanceId,
        counterType: "magnet",
        amount: 3,
        playerId: P1,
      },
    ]);
    expect(magnets(result.state)).toBe(0);
    expect(tracked(result.state, "fired")).toBe(1);
    expectReplays(result);
  });
});
