/**
 * `AbilityCost.resourcesEqualTo`: "spend X resources of any type, where X is [a number the board gives] →", on a
 * synthetic card shaped like Bolstered by Wrath (`next_evol` 40082: "Hero Action: Exhaust a character you control and
 * spend X resources of any type, where X is the number of villains under Routed → discard this card").
 *
 * Sources: RRG 1.8 "Initiating Abilities" (p. 24), step 3: the cost is determined, "taking modifiers into account",
 * before it is paid; "Cost" (p. 13): a cost is paid in full or not at all, and a player may generate more than it
 * needs.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands } from "./testing/drive.js";
import { stubSupport } from "./testing/fixtures.js";
import { giveCards, RESOURCE } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

/** X: the damage on the payer's identity, a number the test sets directly. */
const X: ValueSpec = { kind: "damage", of: { kind: "identityOf", player: { kind: "controller" } } };
/** "Deal damage to the villain equal to the resources spent this way." */
const DEAL_X: EffectSpec = {
  kind: "dealDamage",
  target: { kind: "villain" },
  amount: {
    kind: "sum",
    values: [
      { kind: "var", name: "cost.resources" },
      { kind: "const", value: 1 },
    ],
  },
};

/** "Action: Spend X resources of any type → deal X + 1 damage to the villain." */
const WRATH_ABILITY = stubAbility("wrath.action", {
  trigger: { kind: "action" },
  cost: { resourcesEqualTo: X },
  effects: [DEAL_X],
});
const WRATH = stubSupport({ id: "wrath", cost: 0, abilities: [WRATH_ABILITY.ref] });
/** "Action: Spend 1 resource and X resources of any type → …": the fixed part and X add up. */
const TITHE_ABILITY = stubAbility("tithe.action", {
  trigger: { kind: "action" },
  cost: { resources: 1, resourcesEqualTo: X },
  effects: [DEAL_X],
});
const TITHE = stubSupport({ id: "tithe", cost: 0, abilities: [TITHE_ABILITY.ref] });

const deps: EngineDeps = depsOf(WRATH_ABILITY, TITHE_ABILITY);

function start(card: string, damage: number) {
  const state = gameAtFirstTurn({
    cards: [WRATH, TITHE],
    deps,
    deck: [WRATH.id, TITHE.id, ...copiesOf(RESOURCE.id, 4)],
  });
  const placed = playerCardIntoPlay(state, card as never);
  const given = giveCards(placed.state, P1, RESOURCE.id, RESOURCE.id, RESOURCE.id);
  const identity = mustPlayer(given.state, P1).identity.instanceId;
  const damaged: GameState = {
    ...given.state,
    instances: { ...given.state.instances, [identity]: { ...mustInstance(given.state, identity), damage } },
  };
  return { state: damaged, card: placed.id, wilds: given.ids as readonly InstanceId[] };
}

const use = (card: InstanceId, abilityId: string, spent: readonly InstanceId[]): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: card,
  abilityId: abilityId as never,
  payment: spent.map((fromHand) => ({ fromHand })),
});
const rejected = (state: GameState, command: Command): string => {
  const result = applyCommand(state, command, deps);
  if (result.ok) throw new Error("expected the command to be rejected");
  return result.error.code;
};
const villainDamage = (state: GameState): number => mustInstance(state, activeVillain(state).instanceId).damage;

describe("`AbilityCost.resourcesEqualTo`: spend X resources of any type, X read from the board", () => {
  it("X = 2: one resource is not enough, two pay it, and the effect reads X as `cost.resources`", () => {
    const { state, card, wilds } = start(WRATH.id, 2);
    expect(rejected(state, use(card, WRATH_ABILITY.ref.id, [wilds[0]!]))).toBe("insufficient_resources");
    expect(rejected(state, use(card, WRATH_ABILITY.ref.id, []))).toBe("insufficient_resources");
    const { state: after } = runCommands(state, deps, use(card, WRATH_ABILITY.ref.id, [wilds[0]!, wilds[1]!]));
    expect(villainDamage(after)).toBe(3);
    expect(mustPlayer(after, P1).discard).toEqual(expect.arrayContaining([wilds[0], wilds[1]]));
    expect(mustPlayer(after, P1).hand).toContain(wilds[2]);
  });

  it("X = 0: nothing to spend, the ability is used with no payment", () => {
    const { state, card } = start(WRATH.id, 0);
    const { state: after } = runCommands(state, deps, use(card, WRATH_ABILITY.ref.id, []));
    expect(villainDamage(after)).toBe(1);
  });

  it("X = 3 follows the board: the same card that cost 2 now costs 3", () => {
    const { state, card, wilds } = start(WRATH.id, 3);
    expect(rejected(state, use(card, WRATH_ABILITY.ref.id, [wilds[0]!, wilds[1]!]))).toBe("insufficient_resources");
    const { state: after } = runCommands(state, deps, use(card, WRATH_ABILITY.ref.id, [...wilds]));
    expect(villainDamage(after)).toBe(4);
  });

  it("beside a fixed amount the two add up: 1 + X = 2 is 3 resources, and `cost.resources` is still X", () => {
    const { state, card, wilds } = start(TITHE.id, 2);
    expect(rejected(state, use(card, TITHE_ABILITY.ref.id, [wilds[0]!, wilds[1]!]))).toBe("insufficient_resources");
    const { state: after } = runCommands(state, deps, use(card, TITHE_ABILITY.ref.id, [...wilds]));
    expect(villainDamage(after)).toBe(3);
  });
});
