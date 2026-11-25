/**
 * docs/phase7-wave9.md §3.67: "this group", "a group in your pod", "each group in your pod". Synthetic cards shaped like
 * a Fading Figment (`tt` 55029b: "Choose a group in your pod, then place synergy counters on their Unified Front
 * environment equal to the number of players in their group"), The Mangog (55041: "Each group in your pod places 3
 * shatter counters on their Avatar of Loki villain and 1 synergy counter on one of their Synergy environments."; "Any
 * player in your pod can attack The Mangog as if it were in their game area.") and Laufey (55044).
 *
 * Sources: MC55 p. 10: "In Single Group Mode, the only group in your pod is your own group of 1–4 players"; p. 12:
 * "Unless explicitly stated otherwise, cards and components in one game area cannot affect another game area"; p. 23:
 * the first player resolves what an encounter card does not give to a player. The two-group cases are on hand-built
 * states with a remote coordinator: no game of this project has more than one group.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps, RuleSpec } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { groupId, type InstanceId, type PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { podBlocksOf, podGroupIds, podOf, podSetupFault, SINGLE_GROUP, type GroupRef } from "./pod.js";
import { mustInstance } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubEvent, stubMinion } from "./testing/fixtures.js";
import { defaultPick, giveCard, TREACHERY } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, minionEngagedWith, P1, P2 } from "./testing/wave3.js";

const n = (value: number): ValueSpec => ({ kind: "const", value });
const named = (name: string): TargetRef => ({ kind: "each", query: { name } });
const G1 = groupId("g1");
const G2 = groupId("g2");
const G3 = groupId("g3");

/** "Permanent. Max 1 [per player] synergy counters here." */
const limit = (id: string) =>
  stubAbility(`${id}.constant`, {
    trigger: {
      kind: "constant",
      rules: [
        {
          kind: "counterLimit",
          card: { self: true },
          counterType: "synergy",
          max: { kind: "perPlayer", base: 0, perPlayer: 1 },
        },
      ],
    },
    effects: [],
  });
const FRONT_LIMIT = limit("front");
const RETREAT_LIMIT = limit("retreat");
const FRONT = stubEnvironment({ id: "front", abilities: [FRONT_LIMIT.ref] });
const RETREAT = stubEnvironment({ id: "retreat", abilities: [RETREAT_LIMIT.ref] });

const theirFront = (amount: ValueSpec): EffectSpec => ({
  kind: "addCounters",
  target: named("front"),
  counterType: "synergy",
  amount,
});
const inGroup = (group: GroupRef | "eachInPod", ...effects: readonly EffectSpec[]): EffectSpec => ({
  kind: "inGroup",
  group,
  effects,
});
const chooseGroup: EffectSpec = {
  kind: "chooseGroup",
  chooser: { kind: "firstPlayer" },
  among: "inPod",
  bind: "group",
};
const chosen: GroupRef = { var: "group" };

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** A Fading Figment's second sentence. */
const FIGMENT = action("figment", [
  chooseGroup,
  inGroup(chosen, theirFront({ kind: "groupPlayerCount", group: "self" })),
]);
/** Laufey: "Place 3 shatter counters on the villain. Choose a group in your pod, then place 1 synergy counter on their [front]." */
const GIANT = action("giant", [
  { kind: "addCounters", target: { kind: "villain" }, counterType: "shatter", amount: n(3) },
  chooseGroup,
  inGroup(chosen, theirFront(n(1))),
]);
/** The Mangog's When Defeated. */
const BEAST_BLOCK = inGroup(
  "eachInPod",
  { kind: "addCounters", target: { kind: "villain" }, counterType: "shatter", amount: n(3) },
  { kind: "chooseTarget", slot: "theirs", query: { categories: ["environment"] }, chooser: { kind: "controller" } },
  { kind: "addCounters", target: { kind: "slot", slot: "theirs" }, counterType: "synergy", amount: n(1) },
);
const BEAST_DOWN = action("beast-down", [BEAST_BLOCK]);
/** Two different blocks in one ability, and a block for a group nothing chose. */
const TWICE = action("twice", [
  chooseGroup,
  inGroup(chosen, theirFront(n(1))),
  {
    kind: "if",
    condition: { kind: "varAtLeast", name: "group.made", amount: 1 },
    then: [inGroup(chosen, { kind: "addCounters", target: named("retreat"), counterType: "synergy", amount: n(1) })],
  },
]);
const NOBODY = action("nobody", [inGroup({ var: "never" }, theirFront(n(1)))]);
/** This group, named outright. */
const OURS = action("ours", [inGroup("self", theirFront(n(1)))]);
/** Reads the chosen group's players outside a block. */
const OTHERS = action("others", [
  chooseGroup,
  {
    kind: "addCounters",
    target: named("retreat"),
    counterType: "tally",
    amount: { kind: "groupPlayerCount", group: chosen },
  },
]);
const ACTIONS = [FIGMENT, GIANT, BEAST_DOWN, TWICE, NOBODY, OURS, OTHERS];

/** "Any player in your pod can attack [this minion] as if it were in their game area." */
const REACHABLE: RuleSpec = { kind: "reachableFromPod", card: { self: true }, by: "attack" };
const BEAST_REACH = stubAbility("beast.constant", { trigger: { kind: "constant", rules: [REACHABLE] }, effects: [] });
const BEAST = stubMinion({ id: "beast", atk: 4, sch: 3, hp: 10, hpPerGroup: true, abilities: [BEAST_REACH.ref] });

const BASE = [FRONT_LIMIT, RETREAT_LIMIT, ...ACTIONS.map((a) => a.ability)];
const deps: EngineDeps = depsOf(...BASE, BEAST_REACH);
/** The same cards with the minion's rule unscripted. */
const withoutReach: EngineDeps = depsOf(...BASE);

interface Table {
  readonly state: GameState;
  readonly front: InstanceId;
  readonly retreat: InstanceId;
}
function table(players: 1 | 2 | 3, pod = true): Table {
  const start = gameAtFirstTurn({
    players,
    cards: [FRONT, RETREAT, BEAST, ...ACTIONS.map((a) => a.card)],
    deps,
    deck: ACTIONS.flatMap((a) => copiesOf(a.card.id, 2)),
    encounter: [FRONT.id, RETREAT.id, BEAST.id, ...copiesOf(TREACHERY.id, 20)],
    ...(pod
      ? {
          pod: { groupId: SINGLE_GROUP, coordinator: "local", groupsInPod: 1, groupsInGame: 1, playersInGame: players },
        }
      : {}),
  });
  const front = encounterCardInVillainArea(start, FRONT.id);
  const retreat = encounterCardInVillainArea(front.state, RETREAT.id);
  return { state: retreat.state, front: front.id, retreat: retreat.id };
}
/** The table as one group of a larger pod, coordinated from outside (hand-built). */
const inPod = (t: Table, ...groups: readonly ReturnType<typeof groupId>[]): Table => ({
  ...t,
  state: {
    ...t.state,
    pod: {
      ...podOf(t.state),
      coordinator: "remote",
      groupsInPodAtStart: groups.length,
      groupsInGameAtStart: groups.length,
      groupIdsInPod: groups,
    },
  },
});
function play(
  state: GameState,
  script: (typeof ACTIONS)[number],
  options: { by?: PlayerId; pick?: (state: GameState) => readonly string[]; using?: EngineDeps } = {},
) {
  const by = options.by ?? P1;
  const using = options.using ?? deps;
  const given = giveCard(state, by, script.card.id);
  const asked: { playerId: PlayerId; kind: string; labels: readonly string[] }[] = [];
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice!;
    asked.push({ playerId: choice.playerId, kind: choice.prompt.kind, labels: choice.options.map((o) => o.label) });
    return (options.pick ?? defaultPick)(current);
  };
  const { session, events } = driveSession(
    startSession(given.state),
    using,
    [{ type: "playCard", playerId: by, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    pick,
  );
  const replayed = replay(session.log, using);
  expect(replayed.ok && replayed.state).toEqual(session.state);
  return { state: session.state, events, asked };
}
const synergy = (state: GameState, id: InstanceId) => mustInstance(state, id).counters.synergy ?? 0;
const shatter = (state: GameState) => mustInstance(state, state.activeVillainId).counters.shatter ?? 0;
const chosenGroups = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "groupChosen" ? [{ playerId: e.playerId, groupId: e.groupId }] : []));
const requested = (events: readonly GameEvent[]) =>
  events
    .flatMap((e) => (e.type === "podEffectRequested" ? [{ ...e, type: undefined }] : []))
    .map(({ type: _, ...e }) => e);

describe("one group (Single Group Mode)", () => {
  it("two players: a Fading Figment asks no group question and places 2 synergy counters (max 2)", () => {
    const t = table(2);
    const { state, events, asked } = play(t.state, FIGMENT);
    expect(asked).toEqual([]);
    expect(chosenGroups(events)).toEqual([{ playerId: "p1", groupId: "g1" }]);
    expect(synergy(state, t.front)).toBe(2);
    expect(requested(events)).toEqual([]);
    // A second one finds the environment full.
    const again = play(state, FIGMENT);
    expect(synergy(again.state, t.front)).toBe(2);
    expect(again.events).toContainEqual({
      type: "countersNotPlaced",
      instanceId: t.front,
      counterType: "synergy",
      amount: 2,
      reason: "limit",
    });
  });

  it("the number of players in the group: 1, 2 and 3, and the same with no pod record at all", () => {
    for (const players of [1, 2, 3] as const) {
      const t = table(players);
      expect(synergy(play(t.state, FIGMENT).state, t.front)).toBe(players);
    }
    const bare = table(2, false);
    const { state, events } = play(bare.state, FIGMENT);
    expect("pod" in state).toBe(false);
    expect(synergy(state, bare.front)).toBe(2);
    expect(chosenGroups(events)).toEqual([{ playerId: "p1", groupId: "g1" }]);
  });

  it("the first player chooses the group whoever the card belongs to", () => {
    const t = table(2);
    const { events } = play(t.state, FIGMENT, { by: P2 });
    expect(chosenGroups(events)).toEqual([{ playerId: "p1", groupId: "g1" }]);
  });

  it("each group in your pod: 3 shatter counters, and the first player picks one environment", () => {
    const t = table(2);
    const { state, events, asked } = play(t.state, BEAST_DOWN, {
      by: P2,
      pick: (current) => [
        current.pendingChoice!.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === t.retreat)!.optionId,
      ],
    });
    expect(shatter(state)).toBe(3);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ playerId: "p1", kind: "chooseTarget" });
    expect(asked[0]?.labels).toHaveLength(2);
    expect(synergy(state, t.retreat)).toBe(1);
    expect(synergy(state, t.front)).toBe(0);
    expect(requested(events)).toEqual([]);
  });

  it("this group named outright, and a var that holds no group", () => {
    const t = table(1);
    expect(synergy(play(t.state, OURS).state, t.front)).toBe(1);
    const nobody = play(t.state, NOBODY);
    expect(synergy(nobody.state, t.front)).toBe(0);
    expect(requested(nobody.events)).toEqual([]);
  });

  it("reachableFromPod changes nothing: legalActions is identical with and without it", () => {
    const t = table(2);
    const engaged = minionEngagedWith(t.state, BEAST.id);
    for (const player of [P1, P2])
      expect(legalActions(engaged.state, player, deps)).toEqual(legalActions(engaged.state, player, withoutReach));
    const { session } = driveSession(startSession(engaged.state), deps, [{ type: "endTurn", playerId: P1 }]);
    const other = driveSession(startSession(engaged.state), withoutReach, [{ type: "endTurn", playerId: P1 }]);
    expect(session.state).toEqual(other.session.state);
  });
});

describe("hand-built: two groups, a remote coordinator", () => {
  it("the first player is asked which group, by id", () => {
    const t = inPod(table(2), G1, G2);
    expect(podGroupIds(t.state)).toEqual(["g1", "g2"]);
    const { asked, events, state } = play(t.state, FIGMENT, { by: P2, pick: () => ["0"] });
    expect(asked).toEqual([{ playerId: "p1", kind: "chooseOption", labels: ["g1", "g2"] }]);
    expect(chosenGroups(events)).toEqual([{ playerId: "p1", groupId: "g1" }]);
    expect(synergy(state, t.front)).toBe(2);
    expect(requested(events)).toEqual([]);
  });

  it("a block for the other group places nothing here and is requested of the coordinator, once", () => {
    const t = inPod(table(2), G1, G2);
    const { state, events } = play(t.state, GIANT, { pick: () => ["1"] });
    // The card's first sentence is this group's own; its second crossed to g2.
    expect(shatter(state)).toBe(3);
    expect(synergy(state, t.front)).toBe(0);
    expect(chosenGroups(events)).toEqual([{ playerId: "p1", groupId: "g2" }]);
    expect(requested(events)).toEqual([
      { seq: 1, toGroupId: "g2", sourceCardId: GIANT.card.id, abilityId: GIANT.ability.ref.id, block: 1 },
    ]);
  });

  it("each group in your pod resolves here and is requested once for each other group", () => {
    const two = inPod(table(1), G1, G2);
    const a = play(two.state, BEAST_DOWN);
    expect(shatter(a.state)).toBe(3);
    expect(synergy(a.state, two.front) + synergy(a.state, two.retreat)).toBe(1);
    expect(requested(a.events)).toEqual([
      { seq: 1, toGroupId: "g2", sourceCardId: BEAST_DOWN.card.id, abilityId: BEAST_DOWN.ability.ref.id, block: 1 },
    ]);
    // This group need not be first in its pod's order.
    const three = inPod(table(1), G2, G1, G3);
    const b = play(three.state, BEAST_DOWN);
    expect(shatter(b.state)).toBe(3);
    expect(requested(b.events).map((e) => e.toGroupId)).toEqual(["g2", "g3"]);
  });

  it("a block is named by its place among the ability's blocks, from 1, wherever it sits", () => {
    expect(podBlocksOf(TWICE.ability.definition.effects)).toHaveLength(2);
    expect(podBlocksOf(BEAST_DOWN.ability.definition.effects)).toEqual([BEAST_BLOCK]);
    const t = inPod(table(1), G1, G2);
    const { state, events } = play(t.state, TWICE, { pick: () => ["1"] });
    expect(requested(events).map((e) => e.block)).toEqual([1, 2]);
    expect(synergy(state, t.front) + synergy(state, t.retreat)).toBe(0);
  });

  it("the number of players in another group is not known here", () => {
    const t = inPod(table(2), G1, G2);
    const mine = play(t.state, OTHERS, { pick: () => ["0"] });
    expect(mustInstance(mine.state, t.retreat).counters.tally).toBe(2);
    const theirs = play(t.state, OTHERS, { pick: () => ["1"] });
    expect(mustInstance(theirs.state, t.retreat).counters.tally ?? 0).toBe(0);
  });
});

describe("the pod setup names its groups", () => {
  it("a pod of several groups lists each once, this one included", () => {
    const base = { groupId: G1, coordinator: "remote", groupsInPod: 2, groupsInGame: 2, playersInGame: 4 } as const;
    expect(podSetupFault(base, 2)).toMatch(/names each of them once/);
    expect(podSetupFault({ ...base, groupIdsInPod: [G1, G2] }, 2)).toBeNull();
    expect(podSetupFault({ ...base, groupIdsInPod: [G2, G3] }, 2)).toMatch(/this one included/);
    expect(podSetupFault({ ...base, groupIdsInPod: [G1, G1] }, 2)).toMatch(/once/);
    expect(podSetupFault({ ...base, groupIdsInPod: [G1, G2, G3] }, 2)).toMatch(/names each of them once/);
  });
});
