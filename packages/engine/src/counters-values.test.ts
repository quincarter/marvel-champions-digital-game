/**
 * docs/phase7-wave3.md §3.10: a local counter maximum on `addCounters` (`upTo`, with `bind` for "if you cannot"), and
 * three `ValueSpec`s — `min`, `max`, and `dealtEncounterCount`. Synthetic cards shaped like Groot's Fruition ("Place 2
 * growth counters on Groot (to a maximum of 10)"), Drax ("place 1 vengeance counter here (to a maximum of 3). If you
 * cannot, draw 1 card.") and Star-Lord's Helmet ("+1 hand size for each facedown encounter card in front of you (to a
 * maximum of +3 hand size)").
 *
 * Sources: ruling Mar 30, 2026 (1) ("(to a maximum of X)" is local to that ability); RRG 1.8 "Deal" (p. 14).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });
const you = { kind: "controller" } as const;
const pot: TargetRef = { kind: "each", query: { categories: ["support"], name: "pot" } };

const POT = stubSupport({ id: "pot", cost: 0 });
const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Place 2 growth counters on [the pot] (to a maximum of 10)." */
const FRUITION = actionEvent("fruition", [
  { kind: "addCounters", target: pot, counterType: "growth", amount: n(2), upTo: n(10) },
]);
/** "Place 1 vengeance counter here (to a maximum of 3). If you cannot, draw 1 card." */
const VENGEANCE = actionEvent("vengeance", [
  { kind: "addCounters", target: pot, counterType: "vengeance", amount: n(1), upTo: n(3), bind: "placed" },
  {
    kind: "if",
    condition: { kind: "compare", left: { kind: "var", name: "placed.amount" }, op: "equalTo", right: n(0) },
    then: [{ kind: "draw", player: you, amount: n(1) }],
  },
]);
/** Records min(facedown encounter cards in front of you, 3) and max(…, 1) as counters on the pot. */
const MEASURE = actionEvent("measure", [
  {
    kind: "addCounters",
    target: pot,
    counterType: "min",
    amount: { kind: "min", values: [{ kind: "dealtEncounterCount", player: you }, n(3)] },
  },
  {
    kind: "addCounters",
    target: pot,
    counterType: "max",
    amount: { kind: "max", values: [{ kind: "dealtEncounterCount", player: you }, n(1)] },
  },
]);
const EVENTS = [FRUITION, VENGEANCE, MEASURE];

const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));
const CARDS = [POT, ...EVENTS.map((e) => e.card)];

function withPot(counters: Readonly<Record<string, number>> = {}): { state: GameState; pot: InstanceId } {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: [POT.id, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 3))],
  });
  const placed = playerCardIntoPlay(base, POT.id);
  return {
    pot: placed.id,
    state: {
      ...placed.state,
      instances: { ...placed.state.instances, [placed.id]: { ...mustInstance(placed.state, placed.id), counters } },
    },
  };
}
/** Surgery: `count` encounter cards dealt facedown to p1. */
function dealt(state: GameState, count: number): GameState {
  const deckId = state.encounterDeckOrder[0]!;
  const piles = state.encounterDecks[deckId]!;
  const cards = piles.deck.slice(0, count);
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.slice(count) } },
    players: state.players.map((p) =>
      p.playerId === P1 ? { ...p, dealtEncounter: [...p.dealtEncounter, ...cards] } : p,
    ),
  };
}
const countersOn = (state: GameState, id: InstanceId): Readonly<Record<string, number>> =>
  mustInstance(state, id).counters;

describe("§3.10 `addCounters.upTo`: '(to a maximum of X)', local to the ability", () => {
  it("places them all when there is room", () => {
    const { state, pot: id } = withPot({ growth: 4 });
    expect(countersOn(playFree(state, deps, FRUITION.card.id).state, id)["growth"]).toBe(6);
  });

  it("places only as many as reach the maximum", () => {
    const { state, pot: id } = withPot({ growth: 9 });
    expect(countersOn(playFree(state, deps, FRUITION.card.id).state, id)["growth"]).toBe(10);
  });

  it("places none above the maximum, and removes none another card placed past it (ruling, Mar 30, 2026 (1))", () => {
    const { state, pot: id } = withPot({ growth: 11 });
    expect(countersOn(playFree(state, deps, FRUITION.card.id).state, id)["growth"]).toBe(11);
  });

  it("`bind` reports how many were placed: 'If you cannot, draw 1 card.'", () => {
    const room = withPot({ vengeance: 1 });
    const handRoom = mustPlayer(room.state, P1).hand.length;
    const placed = playFree(room.state, deps, VENGEANCE.card.id).state;
    expect(countersOn(placed, room.pot)["vengeance"]).toBe(2);
    const full = withPot({ vengeance: 3 });
    const handFull = mustPlayer(full.state, P1).hand.length;
    const drew = playFree(full.state, deps, VENGEANCE.card.id).state;
    expect(countersOn(drew, full.pot)["vengeance"]).toBe(3);
    // Handed the event (+1 unless it was already in hand) and played it (-1), and only the full pot draws 1.
    expect(mustPlayer(drew, P1).hand.length - handFull).toBe(mustPlayer(placed, P1).hand.length - handRoom + 1);
  });
});

describe("§3.10 `min`, `max` and `dealtEncounterCount`", () => {
  it("counts the facedown encounter cards in front of a player, capped by `min` and floored by `max`", () => {
    const five = withPot();
    const cappedHigh = playFree(dealt(five.state, 5), deps, MEASURE.card.id).state;
    expect(countersOn(cappedHigh, five.pot)).toMatchObject({ min: 3, max: 5 });
    const none = withPot();
    const flooredLow = playFree(none.state, deps, MEASURE.card.id).state;
    expect(countersOn(flooredLow, none.pot)["min"]).toBeUndefined();
    expect(countersOn(flooredLow, none.pot)["max"]).toBe(1);
  });
});
