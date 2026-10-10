/**
 * docs/phase7-wave9.md §3.5, owner decision Q3 = A: "When [the villain] would be defeated, reset his hit points to 10
 * instead" sets the dial to the printed number, and is a reset at that number: `EffectSpec setRemainingHitPoints` with
 * `reset` announces `TriggerEvent hitPointsReset` below the maximum too.
 *
 * RRG 1.8 "Hit Points" (p. 22): "When an ability that says an identity or villain 'gets +X hit points' goes into
 * effect, increase that character's hit point dial by X. If that ability later ceases to be in effect, reduce that
 * character's hit point dial by X." So with "+5 hit points" attached the reset leaves 10 of 15 (5 sustained damage),
 * and the attachment answering the reset by leaving takes the dial to 5 of 10. Synthetic cards only.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, locateCard, maxHitPoints, mustInstance, remainingHitPoints } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubEvent, stubVillain } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, playFree } from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
const theVillain: TargetRef = { kind: "villain" };
const n = (value: number): ValueSpec => ({ kind: "const", value });
const HOST = { hostOfSelf: true } as const;

/** "Forced Interrupt: When [the villain] would be defeated, reset his hit points to 10 instead." */
const WOULD_FALL = stubAbility("overlord.would-be-defeated", {
  trigger: { kind: "interrupt", forced: true, would: true, on: { on: "characterDefeated", selfIs: "target" } },
  effects: [
    {
      kind: "replaceTriggeringEvent",
      with: [{ kind: "setRemainingHitPoints", target: self, amount: n(10), reset: true }],
    },
  ],
});
const OVERLORD = stubVillain({
  id: "overlord",
  stages: [
    { hp: flat(10), atk: 1, sch: 1, abilities: [WOULD_FALL.ref] },
    { hp: flat(20), atk: 1, sch: 1 },
  ],
});

/** "Attached villain gets +5 hit points." */
const CHASSIS_CONSTANT = stubAbility("chassis.constant", {
  trigger: { kind: "constant", modifiers: [{ stat: "hp", amount: 5, target: HOST }] },
  effects: [],
});
/** "Forced Response: After attached villain's hit points are reset, discard this card." */
const discardAfterReset = (id: string) =>
  stubAbility(`${id}.forced-response`, {
    trigger: { kind: "response", forced: true, on: { on: "hitPointsReset", targetIs: HOST } },
    effects: [{ kind: "discardFromPlay", target: self }],
  });
const CHASSIS_LEAVES = discardAfterReset("chassis");
const CHASSIS = stubAttachment({ id: "chassis", abilities: [CHASSIS_CONSTANT.ref, CHASSIS_LEAVES.ref] });
/** The reset answer alone, with no hit point modifier. */
const LENS_LEAVES = discardAfterReset("lens");
const LENS = stubAttachment({ id: "lens", abilities: [LENS_LEAVES.ref] });
/** "+5 hit points" that stays through a reset. */
const PLATING = stubAttachment({ id: "plating", abilities: [CHASSIS_CONSTANT.ref] });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const hit = (amount: number) => event(`hit-${amount}`, [{ kind: "dealDamage", target: theVillain, amount: n(amount) }]);
const HIT_4 = hit(4);
const HIT_10 = hit(10);
const HIT_15 = hit(15);
const HIT_40 = hit(40);
/** A reset to a number as an ordinary effect, with nothing defeated: still a reset. */
const RESET_TO_7 = event("reset-to-7", [
  { kind: "setRemainingHitPoints", target: theVillain, amount: n(7), reset: true },
]);
/** The same number without the flag: a dial set below the maximum, not a reset (docs/phase7-wave6.md §3.67). */
const SET_7 = event("set-7", [{ kind: "setRemainingHitPoints", target: theVillain, amount: n(7) }]);
const EVENTS = [HIT_4, HIT_10, HIT_15, HIT_40, RESET_TO_7, SET_7];

const deps: EngineDeps = depsOf(
  WOULD_FALL,
  CHASSIS_CONSTANT,
  CHASSIS_LEAVES,
  LENS_LEAVES,
  ...EVENTS.map((e) => e.ability),
);

function start(): GameState {
  return gameAtFirstTurn({
    deps,
    villain: OVERLORD,
    cards: [CHASSIS, LENS, PLATING, ...EVENTS.map((e) => e.card)],
    encounter: [CHASSIS.id, LENS.id, PLATING.id],
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
  });
}

/** Attaches an encounter card to the villain (surgery: no reveal). */
function attached(state: GameState, card: string): { state: GameState; id: InstanceId } {
  const villain = activeVillain(state).instanceId;
  const id = (Object.keys(state.instances) as InstanceId[]).find(
    (key) => state.instances[key]?.cardId === card && !cardsInPlay(state).includes(key),
  );
  if (!id) throw new Error(`no ${card} out of play`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: Object.fromEntries(
        Object.entries(state.encounterDecks).map(([deckId, piles]) => [
          deckId,
          { ...piles, deck: piles.deck.filter((x) => x !== id) },
        ]),
      ),
      instances: {
        ...state.instances,
        [id]: { ...mustInstance(state, id), faceup: true, attachedTo: villain, controllerId: null },
        [villain]: { ...mustInstance(state, villain), attachments: [...mustInstance(state, villain).attachments, id] },
      },
    },
  };
}

const villainId = (state: GameState) => activeVillain(state).instanceId;
const dial = (state: GameState) => remainingHitPoints(state, villainId(state), deps);
const max = (state: GameState) => maxHitPoints(state, villainId(state), deps);
const damage = (state: GameState) => mustInstance(state, villainId(state)).damage;
const inPlay = (state: GameState, id: InstanceId) => cardsInPlay(state).includes(id);
const resetEvents = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "hitPointsReset");
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

describe("§3.5 a reset to a printed number (Q3 = A)", () => {
  it("no modifier: 10 damage on 10 hit points is replaced by a reset to 10 of 10", () => {
    const run = playFree(start(), deps, HIT_10.card.id);
    expect(run.state.outcome).toBeNull();
    expect(activeVillain(run.state).stageIndex).toBe(0);
    expect([dial(run.state), max(run.state), damage(run.state)]).toEqual([10, 10, 0]);
    expect(of(run.events, "characterDefeated")).toEqual([]);
    expect(of(run.events, "hitPointsSet")).toEqual([
      { type: "hitPointsSet", instanceId: villainId(run.state), remaining: 10, damage: 0 },
    ]);
  });

  it("+5 hit points that stays: the dial is set to 10 of 15 (5 damage), not to the maximum", () => {
    const plated = attached(start(), PLATING.id);
    expect([dial(plated.state), max(plated.state)]).toEqual([15, 15]);
    const run = playFree(plated.state, deps, HIT_15.card.id);
    expect([dial(run.state), max(run.state), damage(run.state)]).toEqual([10, 15, 5]);
    expect(inPlay(run.state, plated.id)).toBe(true);
    expect(of(run.events, "hitPointsSet")).toEqual([
      { type: "hitPointsSet", instanceId: villainId(run.state), remaining: 10, damage: 5 },
    ]);
  });

  it("+5 hit points that leaves after the reset: 10 of 15, then the attachment is discarded and he is at 5 of 10", () => {
    const chassis = attached(start(), CHASSIS.id);
    const run = playFree(chassis.state, deps, HIT_15.card.id);
    expect(run.state.outcome).toBeNull();
    expect(activeVillain(run.state).stageIndex).toBe(0);
    expect(locateCard(run.state, chassis.id)?.kind).toBe("encounterDiscard");
    expect([dial(run.state), max(run.state), damage(run.state)]).toEqual([5, 10, 5]);
    expect(resetEvents(run.events)).toEqual([
      expect.objectContaining({ event: { kind: "hitPointsReset", instanceId: villainId(run.state) } }),
    ]);
    // The dial was set before the attachment left: 10 of 15, then the +5 ended (RRG p. 22: "reduce … dial by X").
    expect(of(run.events, "hitPointsSet")).toEqual([
      { type: "hitPointsSet", instanceId: villainId(run.state), remaining: 10, damage: 5 },
    ]);
    // 5 of 10 is not zero: the +5 ending defeats nobody and resets nothing a second time.
    expect(of(run.events, "hitPointsFell")).toEqual([]);
    expect(of(run.events, "characterDefeated")).toEqual([]);
  });

  it("damage past zero is lost: 40 damage ends at the same 5 of 10", () => {
    const run = playFree(attached(start(), CHASSIS.id).state, deps, HIT_40.card.id);
    expect([dial(run.state), max(run.state), damage(run.state)]).toEqual([5, 10, 5]);
  });

  it("a reset below the maximum is announced once to every listener: both attachments leave", () => {
    const chassis = attached(start(), CHASSIS.id);
    const lens = attached(chassis.state, LENS.id);
    const run = playFree(lens.state, deps, HIT_15.card.id);
    expect(inPlay(run.state, chassis.id)).toBe(false);
    expect(inPlay(run.state, lens.id)).toBe(false);
    expect(resetEvents(run.events)).toHaveLength(1);
    expect([dial(run.state), max(run.state)]).toEqual([5, 10]);
  });

  it("the second defeat, from 5 of 10: reset to 10 of 10 with nothing attached", () => {
    const first = playFree(attached(start(), CHASSIS.id).state, deps, HIT_15.card.id);
    expect(dial(first.state)).toBe(5);
    const second = playFree(first.state, deps, HIT_10.card.id);
    expect(second.state.outcome).toBeNull();
    expect([dial(second.state), max(second.state), damage(second.state)]).toEqual([10, 10, 0]);
  });

  it("damage that does not defeat resets nothing: 4 damage on 15 leaves 11 and the attachment stays", () => {
    const chassis = attached(start(), CHASSIS.id);
    const run = playFree(chassis.state, deps, HIT_4.card.id);
    expect([dial(run.state), max(run.state)]).toEqual([11, 15]);
    expect(inPlay(run.state, chassis.id)).toBe(true);
    expect(resetEvents(run.events)).toEqual([]);
  });

  it("the flag is what makes it a reset: 'reset to 7' of 10 is announced, 'set to 7' is not", () => {
    const lens = attached(start(), LENS.id);
    const set = playFree(lens.state, deps, SET_7.card.id);
    expect(dial(set.state)).toBe(7);
    expect(resetEvents(set.events)).toEqual([]);
    expect(inPlay(set.state, lens.id)).toBe(true);

    const reset = playFree(lens.state, deps, RESET_TO_7.card.id);
    expect(dial(reset.state)).toBe(7);
    expect(resetEvents(reset.events)).toHaveLength(1);
    expect(inPlay(reset.state, lens.id)).toBe(false);
  });

  it("replays to the same state", () => {
    const run = playFree(attached(start(), CHASSIS.id).state, deps, HIT_15.card.id);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
  });
});
