/**
 * docs/phase7-wave5.md §3.1: villains that enter and leave play. Synthetic villains shaped like The Sinister Six (`sm`
 * 27094–27099: six one-stage villains, "Activation Order 1"–"6", each "When Defeated: … Set this villain aside."),
 * Sinister Synchronization 1A's Setup ("Choose X villains at random, where X is 1 more than the number of players. Put
 * those villains into play, place the active counter on the villain with the lowest activation order value, and set the
 * other villains aside.") and Ambush! ("Choose a set-aside villain at random, put that villain into play, and place the
 * active counter on it").
 *
 * Sources: MC27 p. 15 ("The Active Counter", "Activation Order") and its p. 21 FAQ; RRG 1.8 p. 62 FAQ (a villain
 * activating while none in play has the counter); RRG 1.8 "Leaves Play" (p. 27), "Set Aside" (p. 39).
 */

import { flat, type VillainCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { replay, startSession } from "./engine.js";
import { activationOrderOf, mustInstance, undefeatedVillains, villainOf } from "./query.js";
import { resolveRef } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, seatIdentities } from "./testing/scenario.js";
import { copiesOf, playFree } from "./testing/wave3.js";

const SET_ASIDE = stubAbility("six.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [{ kind: "setVillainAside", villain: { kind: "self" } }],
});
const six = (order: number): VillainCard => ({
  ...stubVillain({ id: `six-${order}`, stages: [{ hp: flat(5), atk: 0, sch: 0, abilities: [SET_ASIDE.ref] }] }),
  activationOrder: order,
});
const SIX = [1, 2, 3, 4, 5, 6].map(six);

const setAsideVillains = { kind: "encounterSetAside", filter: { categories: ["villain"] } } as const;
const lowestInPlay: TargetRef = {
  kind: "superlative",
  order: "lowest",
  among: { kind: "each", query: { categories: ["villain"] } },
  measure: { kind: "activationOrder", of: { kind: "slot", slot: "candidate" } },
};
const SETUP = stubAbility("synchronization.setup", {
  trigger: { kind: "setup" },
  effects: [
    {
      kind: "selectCards",
      slot: "starting",
      cards: { ...setAsideVillains, random: { kind: "perPlayer", base: 1, perPlayer: 1 } },
    },
    { kind: "addVillain", villain: { kind: "slot", slot: "starting" } },
    { kind: "setActiveVillain", villain: lowestInPlay },
  ],
});
const SYNCHRONIZATION = stubMainScheme({
  id: "synchronization",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0), aSideAbilities: [SETUP.ref] }],
});

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const theVillain: TargetRef = { kind: "villain" };
const SLAY = event("slay", [{ kind: "dealDamage", target: theVillain, amount: { kind: "const", value: 5 } }]);
const WOUND = event("wound", [{ kind: "dealDamage", target: theVillain, amount: { kind: "const", value: 2 } }]);
/** Ambush!: a random set-aside villain enters, reported to `ambush`, and takes the counter. */
const AMBUSH = event("ambush", [
  { kind: "selectCards", slot: "pick", cards: { ...setAsideVillains, random: { kind: "const", value: 1 } } },
  { kind: "addVillain", villain: { kind: "slot", slot: "pick" }, bind: "ambush" },
  { kind: "setActiveVillain", villain: { kind: "slot", slot: "ambush" } },
  {
    kind: "if",
    condition: { kind: "varAtLeast", name: "ambush.count", amount: 1 },
    then: [],
    otherwise: [{ kind: "gainSurge" }],
  },
]);
const PASS = event("pass", [{ kind: "moveActiveCounter", to: "nextInActivationOrder" }]);
const EVENTS = [SLAY, WOUND, AMBUSH, PASS];
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const deps: EngineDeps = depsOf(SET_ASIDE, SETUP, ...EVENTS.map((e) => e.ability));

function start(players: 1 | 2 = 2, seed = 3): GameState {
  const identities = seatIdentities(HERO, players);
  const result = createGame(
    {
      seed,
      cards: [...DEFAULT_CARDS, ...identities, ...SIX, SYNCHRONIZATION, FILLER, ...EVENTS.map((e) => e.card)],
      villainCardId: SIX[0]!.id,
      villains: SIX.map((card) => ({ villainCardId: card.id, encounterDeck: [] })),
      sharedEncounterDeck: true,
      villainsStartSetAside: true,
      activeCounter: "nextInActivationOrder",
      victory: "cardAbility",
      mainSchemeCardId: SYNCHRONIZATION.id,
      encounterDeck: copiesOf(FILLER.id, 20),
      includeIdentitySets: false,
      players: identities.map((identity) => ({
        identityCardId: identity.id,
        deck: [...DEFAULT_DECK, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2))],
      })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}

const orders = (state: GameState): readonly number[] =>
  undefeatedVillains(state)
    .map((v) => activationOrderOf(state, v.instanceId))
    .sort((a, b) => a - b);
const activeOrder = (state: GameState): number => activationOrderOf(state, state.activeVillainId);
const inPlayVillain = (state: GameState): readonly InstanceId[] =>
  resolveRef(state, theVillain, {
    controllerId: state.firstPlayerId,
    selfInstanceId: null,
    scopedPlayerId: null,
    event: null,
    bindings: {},
  });
/**
 * Exactly the villains with these activation orders in play, the others set aside, the counter on the lowest in play
 * (test setup only, standing in for a sequence of Ambush! resolutions).
 */
function keepInPlay(state: GameState, keep: readonly number[]): GameState {
  const inPlay = (id: InstanceId) => keep.includes(activationOrderOf(state, id));
  const villains = state.villains.map((v) => ({ ...v, defeated: !inPlay(v.instanceId) }));
  const others = state.encounterSetAside.filter((id) => !villainOf(state, id));
  const instances = { ...state.instances };
  for (const v of villains) instances[v.instanceId] = { ...instances[v.instanceId]!, faceup: !v.defeated };
  const lowest = villains
    .filter((v) => !v.defeated)
    .sort((a, b) => activationOrderOf(state, a.instanceId) - activationOrderOf(state, b.instanceId))[0];
  return {
    ...state,
    villains,
    instances,
    encounterSetAside: [...others, ...villains.filter((v) => v.defeated).map((v) => v.instanceId)],
    activeVillainId: lowest?.instanceId ?? state.activeVillainId,
  };
}

describe("§3.1 villains that start set aside (MC27 p. 15)", () => {
  it("the Setup puts players + 1 villains into play at random and gives the lowest activation order the counter", () => {
    const state = start(2);
    expect(orders(state)).toHaveLength(3);
    expect(activeOrder(state)).toBe(orders(state)[0]);
    expect(inPlayVillain(state)).toEqual([state.activeVillainId]);
    const setAside = state.encounterSetAside.filter((id) => villainOf(state, id));
    expect(setAside).toHaveLength(3);
    for (const id of setAside) expect(villainOf(state, id)?.defeated).toBe(true);
    // Seeded: the same seed chooses the same villains.
    expect(orders(start(2))).toEqual(orders(state));
  });
});

describe("§3.1 'Set this villain aside' and the activation order", () => {
  it("a defeated villain goes back to the set-aside area as a new copy, and the counter moves to the next in order", () => {
    const withCounter = keepInPlay(start(1), [2, 5]);
    expect(activeOrder(withCounter)).toBe(2);
    const wounded = playFree(withCounter, deps, WOUND.card.id).state;
    const defeatedId = wounded.activeVillainId;
    const { state: after, session } = playFree(wounded, deps, SLAY.card.id);
    expect(after.outcome).toBeNull();
    expect(after.encounterSetAside).toContain(defeatedId);
    expect(mustInstance(after, defeatedId).damage).toBe(0);
    expect(orders(after)).toEqual([5]);
    expect(activeOrder(after)).toBe(5);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("with no other villain in play the counter is set aside: 'the villain' is nobody and nobody wins", () => {
    const state = keepInPlay(start(1), [4]);
    const after = playFree(state, deps, SLAY.card.id).state;
    expect(after.outcome).toBeNull();
    expect(undefeatedVillains(after)).toHaveLength(0);
    expect(inPlayVillain(after)).toEqual([]);
  });

  it("moving the counter goes to the next ascending value and wraps to the lowest; a lone villain keeps it", () => {
    const state = keepInPlay(start(1), [1, 3, 6]);
    const at = (order: number) => ({
      ...state,
      activeVillainId: undefeatedVillains(state).find((v) => activationOrderOf(state, v.instanceId) === order)!
        .instanceId,
    });
    expect(activeOrder(playFree(at(3), deps, PASS.card.id).state)).toBe(6);
    const events: readonly GameEvent[] = playFree(at(6), deps, PASS.card.id).events;
    expect(activeOrder(playFree(at(6), deps, PASS.card.id).state)).toBe(1);
    expect(events.some((e) => e.type === "activeVillainChanged" && e.reason === "activationOrder")).toBe(true);
    const lone = keepInPlay(start(1), [3]);
    expect(activeOrder(playFree(lone, deps, PASS.card.id).state)).toBe(3);
  });
});

describe("§3.1 a set-aside villain comes back (Ambush!)", () => {
  it("it enters with full hit points and the counter, and the effect reports that one entered", () => {
    const emptied = playFree(keepInPlay(start(1), [4]), deps, SLAY.card.id).state;
    const { state: after, events } = playFree(emptied, deps, AMBUSH.card.id);
    expect(undefeatedVillains(after)).toHaveLength(1);
    expect(inPlayVillain(after)).toEqual([after.activeVillainId]);
    expect(mustInstance(after, after.activeVillainId).damage).toBe(0);
    expect(events.some((e) => e.type === "villainAdded")).toBe(true);
  });
});

describe("§3.1 FAQ (RRG 1.8 p. 62): villains in play and none with the counter", () => {
  it("at the villain's activation the lowest activation order takes the counter", () => {
    const state = keepInPlay(start(1), [2, 5]);
    const setAsideId = state.encounterSetAside.find((id) => villainOf(state, id))!;
    const orphaned: GameState = { ...state, activeVillainId: setAsideId };
    expect(inPlayVillain(orphaned)).toEqual([]);
    const step = orphaned.step;
    if (step.kind !== "turn") throw new Error(`expected a turn, got ${step.kind}`);
    const { state: after, events } = (() => {
      const { session, events } = driveSession(startSession(orphaned), deps, [
        { type: "endTurn", playerId: step.activePlayerId },
      ]);
      return { state: session.state, events };
    })();
    expect(events.some((e) => e.type === "activeVillainChanged" && e.reason === "noActiveVillain")).toBe(true);
    expect(activeOrder(after)).toBe(2);
  });
});
