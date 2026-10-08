/**
 * docs/phase7-wave8.md §3.19 and §3.20. `ValueSpec printedHp { of, numeral: true }`: "X is the numeral in Apocalypse's
 * printed hit point value" (The Age of Apocalypse 1B, `aoa` 45103b; The Apocalypse Solution 45111), the number printed
 * before the per player icon, from the villain's current stage, never modified. And the shape it is used in, printed on
 * a main scheme: "Forced Interrupt: When Apocalypse would be defeated, discard each attachment from him and heal all
 * damage from him instead. Remove X threat from this scheme (ignoring any crisis icons)."
 *
 * Sources: RRG 1.8 "Printed" (p. 35), "Per Player Icon" (p. 32), "Replacement Effect" (p. 37: the replaced effect "is
 * no longer considered imminent and no further interrupts or responses to that effect can be triggered"), "'Would'"
 * (p. 48), "Attachment" (p. 8).
 */

import { flat, perPlayerOnly } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { maxHitPoints, mustInstance, printedHpNumeral, villainStageOf } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import {
  stubAttachment,
  stubEvent,
  stubMainScheme,
  stubSideScheme,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import { ALLY, TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const self: TargetRef = { kind: "self" };
const theVillain: TargetRef = { kind: "villain" };
const eventTarget: TargetRef = { kind: "eventTarget" };
const NUMERAL: ValueSpec = { kind: "printedHp", of: theVillain, numeral: true };
const SCALED: ValueSpec = { kind: "printedHp", of: theVillain };
const constant = (value: number): ValueSpec => ({ kind: "const", value });

/** "When [the villain] would be defeated, discard each attachment from him and heal all damage from him instead. Remove X threat from this scheme (ignoring any crisis icons)." */
const INSTEAD = stubAbility("age.forced-interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    would: true,
    on: { on: "characterDefeated", targetIs: { categories: ["villain"] } },
  },
  effects: [
    {
      kind: "replaceTriggeringEvent",
      with: [
        {
          kind: "discardFromPlay",
          target: { kind: "each", query: { categories: ["attachment"], host: eventTarget } },
        },
        { kind: "heal", target: eventTarget, amount: { kind: "damage", of: eventTarget } },
      ],
    },
    { kind: "removeThreat", target: self, amount: NUMERAL, ignoreCrisis: true },
  ],
} as AbilityDefinition);
/** Would answer a defeat that happened: it must not. */
const AFTER_DEFEAT = stubAbility("witness.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "characterDefeated", targetIs: { categories: ["villain"] } },
  },
  effects: [{ kind: "addCounters", target: self, counterType: "sawDefeat", amount: constant(1) }],
} as AbilityDefinition);
/** A hit point modifier on the villain: the numeral is printed, so this changes nothing. */
const BIGGER = stubAbility("bigger.constant", {
  trigger: { kind: "constant", modifiers: [{ stat: "hp", amount: 5, target: { categories: ["villain"] } }] },
  effects: [],
} as AbilityDefinition);

const TYRANT = stubVillain({
  id: "tyrant",
  stages: [
    { hp: perPlayerOnly(9), atk: 2, sch: 2, keywords: [{ name: "toughness" }] },
    { hp: perPlayerOnly(10), atk: 3, sch: 2, keywords: [{ name: "toughness" }] },
    { hp: flat(14), atk: 3, sch: 3 },
  ],
});
const AGE = stubMainScheme({
  id: "age",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), abilities: [INSTEAD.ref] }],
});
const CRISIS = stubSideScheme({ id: "crisis", startingThreat: 3, icons: ["crisis"] });
const GEAR = stubAttachment({ id: "gear" });
const PLATE = stubAttachment({ id: "plate", abilities: [BIGGER.ref] });
const WITNESS = stubUpgrade({ id: "witness", cost: 0, abilities: [AFTER_DEFEAT.ref] });
const TRACKER = stubUpgrade({ id: "tracker", cost: 0 });

const eachTracker: TargetRef = { kind: "each", query: { categories: ["upgrade"], name: "tracker" } };
const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** Writes both readings of the villain's printed hit points onto the tracker. */
const MEASURE = action("measure", [
  { kind: "addCounters", target: eachTracker, counterType: "numeral", amount: NUMERAL },
  { kind: "addCounters", target: eachTracker, counterType: "scaled", amount: SCALED },
  {
    kind: "addCounters",
    target: eachTracker,
    counterType: "allyNumeral",
    amount: { kind: "printedHp", of: { kind: "each", query: { categories: ["ally"] } }, numeral: true },
  },
]);
const STRIKE = action("strike", [{ kind: "dealDamage", target: theVillain, amount: constant(12) }]);
const ACTIONS = [MEASURE, STRIKE];
const deps: EngineDeps = depsOf(INSTEAD, AFTER_DEFEAT, BIGGER, ...ACTIONS.map((a) => a.ability));

function start(players: 1 | 3 = 1, stageIndex = 0): GameState {
  const base = gameAtFirstTurn({
    cards: [TYRANT, AGE, CRISIS, GEAR, PLATE, WITNESS, TRACKER, ...ACTIONS.map((a) => a.card)],
    deps,
    villain: TYRANT,
    mainScheme: AGE,
    players,
    encounter: [CRISIS.id, GEAR.id, PLATE.id, ...copiesOf(TREACHERY.id, 20)],
    deck: [WITNESS.id, TRACKER.id, ...ACTIONS.flatMap((a) => copiesOf(a.card.id, 2))],
  });
  const bare: GameState = {
    ...base,
    villains: base.villains.map((v) => ({ ...v, stageIndex })),
    instances: {
      ...base.instances,
      [base.activeVillainId]: {
        ...mustInstance(base, base.activeVillainId),
        statuses: { stunned: 0, confused: 0, tough: 0 },
      },
    },
  };
  return playerCardIntoPlay(bare, TRACKER.id).state;
}
/** Moves a card out of the villain's area or a play area and attaches it to the villain (surgery). */
function attachToVillain(state: GameState, id: InstanceId): GameState {
  const host = mustInstance(state, state.activeVillainId);
  return {
    ...state,
    villainArea: state.villainArea.filter((x) => x !== id),
    players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((x) => x !== id) })),
    instances: {
      ...state.instances,
      [id]: { ...mustInstance(state, id), attachedTo: host.instanceId, faceup: true },
      [host.instanceId]: { ...host, attachments: [...host.attachments, id] },
    },
  };
}
const withAttachment = (state: GameState, card: { id: string }) => {
  const placed = encounterCardInVillainArea(state, card.id as never);
  return { state: attachToVillain(placed.state, placed.id), id: placed.id };
};
const patch = (state: GameState, id: InstanceId, change: Partial<GameState["instances"][string]>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), ...change } },
});
const tracker = (state: GameState) =>
  mustInstance(state, Object.values(state.instances).find((i) => i.cardId === TRACKER.id)!.instanceId).counters;
const villain = (state: GameState) => mustInstance(state, state.activeVillainId);
const threat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
const types = (events: readonly GameEvent[]) => events.map((e) => e.type);

describe("§3.19 printedHp { numeral }: the number printed before the per player icon", () => {
  it("1 player: the numeral and the scaled value agree (9)", () => {
    const after = playFree(start(1), deps, MEASURE.card.id).state;
    expect(tracker(after)).toMatchObject({ numeral: 9, scaled: 9 });
  });

  it("3 players: the numeral is still 9, the scaled value 27", () => {
    const after = playFree(start(3), deps, MEASURE.card.id).state;
    expect(tracker(after)).toMatchObject({ numeral: 9, scaled: 27 });
  });

  it("it is read from the current stage: 10 on the next one", () => {
    const after = playFree(start(3, 1), deps, MEASURE.card.id).state;
    expect(tracker(after)).toMatchObject({ numeral: 10, scaled: 30 });
  });

  it("a value printed without the icon is its own numeral", () => {
    const state = start(3, 2);
    expect(printedHpNumeral(state, state.activeVillainId)).toBe(14);
    expect(tracker(playFree(state, deps, MEASURE.card.id).state)).toMatchObject({ numeral: 14, scaled: 14 });
  });

  it("it is never modified: +5 hit points on the villain changes his dial and not the numeral", () => {
    const plated = withAttachment(start(3), PLATE).state;
    expect(maxHitPoints(plated, plated.activeVillainId, deps)).toBe(32);
    const after = playFree(plated, deps, MEASURE.card.id).state;
    expect(tracker(after)).toMatchObject({ numeral: 9, scaled: 27 });
  });

  it("a character with no per player icon: its printed hit points", () => {
    const ally = playerCardIntoPlay(start(3), ALLY.id);
    const after = playFree(ally.state, deps, MEASURE.card.id).state;
    expect(tracker(after).allyNumeral).toBe(ALLY.hp);
  });
});

describe("§3.20 'when the villain would be defeated … instead', printed on the main scheme", () => {
  function hit(players: 1 | 3, schemeThreat: number) {
    const gear = withAttachment(start(players), GEAR);
    const plate = withAttachment(gear.state, PLATE);
    const upgrade = playerCardIntoPlay(plate.state, WITNESS.id);
    const crisis = encounterCardInVillainArea(attachToVillain(upgrade.state, upgrade.id), CRISIS.id, 3);
    const ready = patch(
      patch(crisis.state, crisis.state.mainScheme.instanceId, { threat: schemeThreat }),
      crisis.state.activeVillainId,
      { damage: 2, statuses: { stunned: 0, confused: 1, tough: 0 }, counters: { mark: 1 } },
    );
    const run = playFree(ready, deps, STRIKE.card.id);
    return { ...run, gear: gear.id, plate: plate.id, upgrade: upgrade.id };
  }

  it("1 player, 12 damage to a 9 hit point stage: attachments discarded, all damage healed, the stage stays, 9 threat removed", () => {
    const { state: after, events, gear, plate, upgrade } = hit(1, 7);
    expect(after.outcome).toBeNull();
    // Each card of the attachment type is discarded; a player's upgrade attached to him is an upgrade and stays.
    expect(cardsInPlay(after)).not.toContain(gear);
    expect(cardsInPlay(after)).not.toContain(plate);
    expect(villain(after).attachments).toEqual([upgrade]);
    // Healed in full, with the +5 gone: 9 hit points, and excess damage is lost.
    expect(villain(after).damage).toBe(0);
    expect(maxHitPoints(after, after.activeVillainId, deps)).toBe(9);
    // Not a defeat: the same stage, no tough card for a stage that did not enter play, status and counters kept.
    expect(villainStageOf(after, after.activeVillainId).stageNumber).toBe(1);
    expect(villain(after).statuses).toEqual({ stunned: 0, confused: 1, tough: 0 });
    expect(villain(after).counters).toEqual({ mark: 1 });
    expect(types(events)).not.toContain("villainStageAdvanced");
    expect(types(events)).not.toContain("characterDefeated");
    // Nothing answers the defeat that was replaced.
    expect(mustInstance(after, upgrade).counters["sawDefeat"]).toBeUndefined();
    // X is the bare numeral, 9, and the scheme stops at 0, whatever crisis icon is in play.
    expect(threat(after)).toBe(0);
  });

  it("3 players, main scheme at 20: X is 9, not 27, so 11 threat is left", () => {
    const { state: after } = hit(3, 20);
    // 12 damage does not defeat a 27 hit point villain plus 5: no interrupt at all.
    expect(threat(after)).toBe(20);
    const lethal = patch(after, after.activeVillainId, { damage: 26 });
    const again = playFree(lethal, deps, STRIKE.card.id).state;
    expect(villain(again).damage).toBe(0);
    expect(threat(again)).toBe(11);
  });
});
