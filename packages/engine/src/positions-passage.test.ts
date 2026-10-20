/**
 * Shadowland (MC65) engine items M1, M4, M5 and the FAQ's "then" (docs/phase7-shadowland.md §6 "Rules brief"), proven
 * with synthetic cards and composed from existing primitives:
 *
 * - **M1 positions** (insert p. 8): two double-sided environments, one with a villain-position trait and one with a
 *   hero-position trait. "The positions are the same" is `exists` the villain-position card that `sharesTitleWith` the
 *   hero-position card (each card's faceup title; `titles.ts`), "different" is its `not`; "change the villain's
 *   position" is `flipCard` addressed by the trait. A flip keeps tokens (RRG 1.8 "Flip", p. 20).
 * - **FAQ p. 18**: "Resolve one of the effects below, then flip this card" with the chosen "Place 3 threat on the main
 *   scheme and stun your identity" while the identity is already stunned: the threat is placed, the stun is not given
 *   (RRG 1.8 "Status Cards", p. 41), so the effect did not fully resolve and the card does not flip (RRG 1.8 "'Then'",
 *   p. 44; `PreThenFailure statusNotGiven`).
 * - **M4 infinite hit points** (insert p. 13; RRG 1.8 "Hit Points", p. 22): damage is dealt and taken, triggers on it
 *   fire, and the villain is never defeated by it (docs/phase7-wave3.md §3.1 precedent).
 * - **M5 passage counters** (insert p. 13): "if no passage counters remain, the players lose" is a `stateCheck` on the
 *   villain's counters of that kind, ending the game as a card-ability loss as soon as the last one is removed.
 */

import { flat, trait, type AnyCard, type CardId, type VillainCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import { evaluate } from "./select.js";
import type { EffectSpec, Predicate, TargetQuery, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubEnvironment, stubEvent, stubSupport, stubVillain } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  P1,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const VILLAIN_POSITION = trait("Villain Position");
const HERO_POSITION = trait("Hero Position");
const LOW = "Low Road";
const HIGH = "High Roof";
const n = (value: number) => ({ kind: "const", value }) as const;
const self: TargetRef = { kind: "self" };
const each = (query: TargetQuery): TargetRef => ({ kind: "each", query });
const villainPosition: TargetQuery = { categories: ["environment"], trait: VILLAIN_POSITION };
const heroPosition: TargetQuery = { categories: ["environment"], trait: HERO_POSITION };
const positionsSame: Predicate = {
  kind: "exists",
  query: { ...villainPosition, sharesTitleWith: each(heroPosition) },
};
const positionsDifferent: Predicate = { kind: "not", of: positionsSame };
const villainPositionIs = (name: string): Predicate => ({ kind: "exists", query: { ...villainPosition, name } });

const position = (id: string, positionTrait: typeof VILLAIN_POSITION) =>
  stubEnvironment({
    id,
    name: LOW,
    traits: [positionTrait],
    flipSide: { name: HIGH, traits: [positionTrait] },
  });
const VILLAIN_POS = position("pos-villain", VILLAIN_POSITION);
const HERO_POS = position("pos-hero", HERO_POSITION);
/** The same villain-position card with its faces emitted as two cards (`BaseCard.otherFaceId`). */
const VILLAIN_POS_A = {
  ...stubEnvironment({ id: "pos-villain-a", name: LOW, traits: [VILLAIN_POSITION] }),
  otherFaceId: "pos-villain-b" as CardId,
};
const VILLAIN_POS_B = {
  ...stubEnvironment({ id: "pos-villain-b", name: HIGH, traits: [VILLAIN_POSITION] }),
  otherFaceId: "pos-villain-a" as CardId,
};

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const flipVillainPosition: EffectSpec = { kind: "flipCard", target: each(villainPosition) };
/** "Change the villain's position." */
const CHANGE = actionEvent("change", [flipVillainPosition]);
/** "Change the hero's position." */
const CHANGE_HERO = actionEvent("change-hero", [{ kind: "flipCard", target: each(heroPosition) }]);
/** "Resolve one of the effects below, then flip [the villain position]." (FAQ p. 18's shape.) */
const RESOLVE_ONE = actionEvent("resolve-one", [
  {
    kind: "chooseOne",
    chooser: { kind: "controller" },
    options: [
      {
        label: "threat and stun",
        effects: [
          { kind: "placeThreat", target: { kind: "mainScheme" }, amount: n(3) },
          { kind: "giveStatus", target: { kind: "identityOf", player: { kind: "controller" } }, status: "stunned" },
        ],
      },
    ],
  },
  { kind: "then", effects: [flipVillainPosition] },
]);
const HIT_50 = actionEvent("hit-50", [{ kind: "dealDamage", target: { kind: "villain" }, amount: n(50) }]);
const REMOVE_PASSAGE = actionEvent("remove-passage", [
  { kind: "removeCounters", target: { kind: "villain" }, counterType: "passage", amount: n(1) },
]);

/** "If no passage counters remain, the players lose the game." */
const PASSAGE_LOSS = stubAbility("maze.passage-loss", {
  trigger: {
    kind: "stateCheck",
    when: { kind: "compare", left: { kind: "counters", of: self, counterType: "passage" }, op: "atMost", right: n(0) },
  },
  effects: [{ kind: "endGame", result: "loss", reason: "cardAbility" }],
});
/** "Forced Response: After damage is placed here, place 1 seen counter here." */
const DAMAGE_SEEN = stubAbility("maze.damage-seen", {
  trigger: { kind: "response", forced: true, on: { on: "dealDamage", selfIs: "target" } },
  effects: [{ kind: "addCounters", target: self, counterType: "seen", amount: n(1) }],
});
const MAZE: VillainCard = stubVillain({
  id: "maze",
  name: "Maze",
  stages: [{ hp: flat(0), infiniteHp: true, atk: 0, sch: 0, abilities: [PASSAGE_LOSS.ref, DAMAGE_SEEN.ref] }],
});

// Supports that change how the identity takes a stunned status card.
const yourIdentity: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const grants = (id: string, name: "steady" | "stalwart") => {
  const ability = stubAbility(`${id}.constant`, {
    trigger: { kind: "constant", keywordGrants: [{ keyword: { name }, target: { categories: ["identity"] } }] },
    effects: [],
  });
  return { card: stubSupport({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const STEADY = grants("steadier", "steady");
const STALWART = grants("stalwarter", "stalwart");
const wouldStun = {
  on: "statusBeingGiven",
  targetIs: { categories: ["identity"] },
  eventIs: { status: "stunned" },
} as const;
/** "Forced Interrupt: When your identity would gain a stunned status card, place 1 shield counter here instead." */
const SHIELD = (() => {
  const ability = stubAbility("shield.forced-interrupt", {
    trigger: { kind: "interrupt", forced: true, would: true, on: wouldStun },
    effects: [
      {
        kind: "replaceTriggeringEvent",
        with: [{ kind: "addCounters", target: self, counterType: "shield", amount: n(1) }],
      },
    ],
  });
  return { card: stubSupport({ id: "shield", cost: 0, abilities: [ability.ref] }), ability };
})();
/** "Forced Interrupt (once per round): When your identity would gain a stunned status card, stun your identity." */
const PREEMPT = (() => {
  const ability = stubAbility("preempt.forced-interrupt", {
    trigger: { kind: "interrupt", forced: true, on: wouldStun },
    limit: { count: 1, period: "round" },
    effects: [{ kind: "giveStatus", target: yourIdentity, status: "stunned" }],
  });
  return { card: stubSupport({ id: "preempt", cost: 0, abilities: [ability.ref] }), ability };
})();
const SUPPORTS = [STEADY, STALWART, SHIELD, PREEMPT];

const EVENTS = [CHANGE, CHANGE_HERO, RESOLVE_ONE, HIT_50, REMOVE_PASSAGE];
const ALL: readonly StubAbility[] = [
  PASSAGE_LOSS,
  DAMAGE_SEEN,
  ...EVENTS.map((e) => e.ability),
  ...SUPPORTS.map((e) => e.ability),
];
const deps: EngineDeps = depsOf(...ALL);
const CARDS: readonly AnyCard[] = [
  VILLAIN_POS,
  HERO_POS,
  VILLAIN_POS_A,
  VILLAIN_POS_B,
  ...EVENTS.map((e) => e.card),
  ...SUPPORTS.map((e) => e.card),
];

function start(
  villain?: VillainCard,
  villainPosCard: AnyCard = VILLAIN_POS,
): { state: GameState; villainPos: InstanceId; heroPos: InstanceId } {
  const base = gameAtFirstTurn({
    cards: CARDS,
    deps,
    ...(villain ? { villain } : {}),
    encounter: [villainPosCard.id, HERO_POS.id, ...copiesOf(TREACHERY.id, 20)],
    deck: [...EVENTS.flatMap((e) => copiesOf(e.card.id, 3)), ...SUPPORTS.map((e) => e.card.id)],
  });
  const v = encounterCardInVillainArea(base, villainPosCard.id);
  const h = encounterCardInVillainArea(v.state, HERO_POS.id);
  return { state: h.state, villainPos: v.id, heroPos: h.id };
}
const holds = (state: GameState, predicate: Predicate) => evaluate(state, predicate, { controllerId: P1 } as never);
const play = (state: GameState, event: { card: AnyCard }) => playFree(state, deps, event.card.id).state;
const withCounters = (state: GameState, id: InstanceId, counters: Record<string, number>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...mustInstance(state, id), counters } },
});
const identityId = (state: GameState) => mustPlayer(state, P1).identity.instanceId;
const mainThreat = (state: GameState) => mustInstance(state, state.mainScheme!.instanceId).threat;

describe("M1: villain and hero positions (insert p. 8)", () => {
  it("compares the two faceup titles, and 'change the villain's position' flips only the villain-position card", () => {
    let { state, villainPos, heroPos } = start();
    expect([holds(state, positionsSame), holds(state, positionsDifferent)]).toEqual([true, false]);
    expect(holds(state, villainPositionIs(LOW))).toBe(true);

    state = withCounters(state, villainPos, { mark: 2 });
    state = play(state, CHANGE);
    expect(mustInstance(state, villainPos).flipped).toBe(true);
    expect(mustInstance(state, heroPos).flipped ?? false).toBe(false);
    expect(mustInstance(state, villainPos).counters["mark"]).toBe(2); // a flip is not leaving play
    expect(holds(state, villainPositionIs(HIGH))).toBe(true);
    expect([holds(state, positionsSame), holds(state, positionsDifferent)]).toEqual([false, true]);

    state = play(state, CHANGE_HERO);
    expect([holds(state, positionsSame), holds(state, positionsDifferent)]).toEqual([true, false]);
  });

  it("reads the same way when the two faces are emitted as two cards (otherFaceId)", () => {
    let { state, villainPos } = start(undefined, VILLAIN_POS_A);
    state = withCounters(state, villainPos, { mark: 2 });
    expect(holds(state, positionsSame)).toBe(true);
    state = play(state, CHANGE);
    expect([holds(state, villainPositionIs(HIGH)), holds(state, positionsDifferent)]).toEqual([true, true]);
    const shown = state.villainArea.find((id) => mustInstance(state, id).cardId === VILLAIN_POS_B.id);
    expect(shown && mustInstance(state, shown).counters["mark"]).toBe(2);
    state = play(state, CHANGE);
    expect([holds(state, villainPositionIs(LOW)), holds(state, positionsSame)]).toEqual([true, true]);
  });
});

describe("FAQ p. 18: 'Resolve one of the effects below, then flip this card'", () => {
  it("flips once the chosen effect fully resolves", () => {
    const { state, villainPos } = start();
    const before = mainThreat(state);
    const after = play(state, RESOLVE_ONE);
    expect(mainThreat(after)).toBe(before + 3);
    expect(mustInstance(after, identityId(after)).statuses.stunned).toBe(1);
    expect(mustInstance(after, villainPos).flipped).toBe(true);
  });

  it("does not flip when the identity is already stunned: the stun cannot be given", () => {
    const begun = start();
    const id = identityId(begun.state);
    const identity = mustInstance(begun.state, id);
    const state: GameState = {
      ...begun.state,
      instances: { ...begun.state.instances, [id]: { ...identity, statuses: { ...identity.statuses, stunned: 1 } } },
    };
    const before = mainThreat(state);
    const { state: after, events } = playFree(state, deps, RESOLVE_ONE.card.id);
    expect(mainThreat(after)).toBe(before + 3);
    expect(mustInstance(after, id).statuses.stunned).toBe(1);
    expect(mustInstance(after, begun.villainPos).flipped ?? false).toBe(false);
    expect(events).toContainEqual({ type: "preThenUnresolved", cause: "statusNotGiven", instanceId: id });
    expect(events).toContainEqual({ type: "thenSkipped" });
  });

  /** The game with `support` in p1's play area and, optionally, the identity already holding one stunned card. */
  const withSupport = (support: { card: AnyCard }, stunned = 0) => {
    const begun = start();
    const placed = playerCardIntoPlay(begun.state, support.card.id);
    const id = identityId(placed.state);
    const identity = mustInstance(placed.state, id);
    const state: GameState = {
      ...placed.state,
      instances: { ...placed.state.instances, [id]: { ...identity, statuses: { ...identity.statuses, stunned } } },
    };
    return { state, id, support: placed.id, villainPos: begun.villainPos };
  };

  it("steady: an identity holding one stunned card has room for a second, so the card flips", () => {
    const { state, id, villainPos } = withSupport(STEADY, 1);
    const after = play(state, RESOLVE_ONE);
    expect(mustInstance(after, id).statuses.stunned).toBe(2);
    expect(mustInstance(after, villainPos).flipped).toBe(true);
  });

  it("stalwart: the identity can never be stunned, so the card never flips", () => {
    const { state, id, villainPos } = withSupport(STALWART);
    const before = mainThreat(state);
    const after = play(state, RESOLVE_ONE);
    expect(mainThreat(after)).toBe(before + 3);
    expect(mustInstance(after, id).statuses.stunned).toBe(0);
    expect(mustInstance(after, villainPos).flipped ?? false).toBe(false);
  });

  it("a stun replaced in its window ('… instead') did not resolve: no flip (engine reading)", () => {
    const { state, id, support, villainPos } = withSupport(SHIELD);
    const { state: after, events } = playFree(state, deps, RESOLVE_ONE.card.id);
    expect(mustInstance(after, support).counters["shield"]).toBe(1);
    expect(mustInstance(after, id).statuses.stunned).toBe(0);
    expect(mustInstance(after, villainPos).flipped ?? false).toBe(false);
    expect(events).toContainEqual({ type: "preThenUnresolved", cause: "statusNotGiven", instanceId: id });
  });

  it("a stun whose room is filled in its window is not given, so the card does not flip", () => {
    const { state, id, villainPos } = withSupport(PREEMPT);
    const { state: after, events } = playFree(state, deps, RESOLVE_ONE.card.id);
    // The interrupt's own stun landed; the effect's card then had no room.
    expect(mustInstance(after, id).statuses.stunned).toBe(1);
    expect(mustInstance(after, villainPos).flipped ?? false).toBe(false);
    expect(events).toContainEqual({ type: "preThenUnresolved", cause: "statusNotGiven", instanceId: id });
  });
});

describe("M4 and M5: infinite hit points and passage counters (insert p. 13)", () => {
  it("takes damage, hears it, and is never defeated by it", () => {
    const { state } = start(MAZE);
    const maze = activeVillain(state).instanceId;
    const after = play(state, HIT_50);
    expect(mustInstance(after, maze).damage).toBe(50);
    expect(mustInstance(after, maze).counters["seen"]).toBe(1);
    expect(after.outcome).toBeNull();
    expect(after.villains.find((v) => v.instanceId === maze)).toBeDefined();
  });

  it("loses as soon as the last passage counter is removed", () => {
    const begun = start(MAZE);
    const maze = activeVillain(begun.state).instanceId;
    let state = withCounters(begun.state, maze, { passage: 2 });
    state = play(state, REMOVE_PASSAGE);
    expect(state.outcome).toBeNull();
    state = play(state, REMOVE_PASSAGE);
    expect(state.outcome).toEqual({ result: "loss", reason: "cardAbility", sourceInstanceId: maze });
  });
});
