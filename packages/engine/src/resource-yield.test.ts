/**
 * docs/phase7-wave7.md §3.80: a resource card whose yield is computed (`ResourceMultiplierSpec.thisCardGenerates`, a
 * `factor` that is a value, `additional`), on synthetic cards shaped like Montage (`deadpool` 44007: "This card
 * generates 1 additional [wild] resource for each acceleration token on the main scheme (to a maximum of 3 additional
 * resources)") and Self Confidence (44025: "Double the number of resources this card generates if your identity has
 * sustained less than 5 damage (triple the resources instead if you have sustained no damage)").
 *
 * Sources: RRG 1.8 "Resource" (p. 37) and "Cost" (p. 13): resources are generated as the card is spent, so the yield
 * is read then. "Wild Resource" (p. 48): each wild of a multiplied card is declared separately, so they stay wild in
 * the pool. Ruling, January 11, 2026 - Ruling 3: a "printed resource" is the icon in the bottom left corner, which
 * neither text changes.
 */

import { flat, type AnyCard, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, ResourceMultiplierSpec } from "./abilities.js";
import { handCardResources } from "./actions.js";
import type { Command } from "./commands.js";
import { applyCommand } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { poolOf } from "./resources.js";
import { printedResourcesOf } from "./select.js";
import type { TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubEvent, stubMainScheme, stubResource, stubVillain } from "./testing/fixtures.js";
import { giveCards, newGame, RESOURCE, runWith } from "./testing/scenario.js";

const p1 = playerId("p1");
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 1, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(1) }],
});

const yourIdentity: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const value = (n: number): ValueSpec => ({ kind: "const", value: n });
const damage: ValueSpec = { kind: "damage", of: yourIdentity };
const tokens: ValueSpec = { kind: "accelerationTokens", on: { kind: "mainScheme" } };
const when = (op: "equalTo" | "atMost", right: number, then: ValueSpec, otherwise: ValueSpec): ValueSpec => ({
  kind: "conditional",
  if: { kind: "compare", left: damage, op, right: value(right) },
  then,
  else: otherwise,
});

const constant = (id: string, resourceMultiplier: ResourceMultiplierSpec): StubAbility =>
  stubAbility(id, { trigger: { kind: "constant", resourceMultiplier }, effects: [] } satisfies AbilityDefinition);

/** "This card generates 1 additional [wild] resource for each acceleration token on the main scheme (max 3)." */
const MONTAGE_TEXT = constant("montage.constant", {
  thisCardGenerates: true,
  additional: { resource: "wild", amount: { kind: "min", values: [tokens, value(3)] } },
});
/** "Double the number of resources this card generates if … less than 5 damage (triple … if no damage)." */
const SELF_TEXT = constant("self.constant", {
  thisCardGenerates: true,
  factor: when("equalTo", 0, value(3), when("atMost", 4, value(2), value(1))),
});
/** One more [wild], then triple the wilds: the added one is tripled too, the [energy] is not. */
const BOTH_TEXT = constant("both.constant", {
  thisCardGenerates: true,
  additional: { resource: "wild", amount: value(1) },
  factor: 3,
  resource: "wild",
});
/** "Double the number of [wild] resources generated while paying for this card." */
const DOUBLED_TEXT = constant("doubled.constant", { factor: 2, forThisCard: true, resource: "wild" });
/** The same direction with a factor read from the table: 1 more than the damage on the payer's identity. */
const SCALING_TEXT = constant("scaling.constant", {
  factor: { kind: "sum", values: [damage, value(1)] },
  forThisCard: true,
});
/** A factor that reads below 0 generates nothing rather than a negative pool. */
const NEGATIVE_TEXT = constant("negative.constant", { thisCardGenerates: true, factor: value(-2) });
/** "Double the number of resources this card generates while paying for an [aggression] card." */
const POWER_TEXT = constant("power.constant", { factor: 2, whilePayingFor: { aspect: "aggression" } });

const MONTAGE = stubResource({ id: "montage", icons: 1, abilities: [MONTAGE_TEXT.ref] });
const SELF = stubResource({ id: "self", icons: 0, produces: { physical: 1 }, abilities: [SELF_TEXT.ref] });
const BOTH = stubResource({ id: "both", icons: 0, produces: { energy: 1, wild: 1 }, abilities: [BOTH_TEXT.ref] });
const NEGATIVE = stubResource({ id: "negative", icons: 1, abilities: [NEGATIVE_TEXT.ref] });
const MONTAGE_POWER = stubResource({ id: "montage-power", icons: 1, abilities: [MONTAGE_TEXT.ref, POWER_TEXT.ref] });
const COST4 = stubEvent({ id: "cost4", cost: 4 });
const COST5 = stubEvent({ id: "cost5", cost: 5 });
const DOUBLED = stubEvent({ id: "doubled", cost: 8, abilities: [DOUBLED_TEXT.ref] });
const SCALING = stubEvent({ id: "scaling", cost: 3, abilities: [SCALING_TEXT.ref] });
const AGGRO = stubEvent({ id: "aggro", cost: 1, aspect: "aggression" });

const ABILITIES = [MONTAGE_TEXT, SELF_TEXT, BOTH_TEXT, DOUBLED_TEXT, SCALING_TEXT, NEGATIVE_TEXT, POWER_TEXT];
const CARDS: readonly AnyCard[] = [MONTAGE, SELF, BOTH, NEGATIVE, MONTAGE_POWER, COST4, COST5, DOUBLED, SCALING, AGGRO];
const deps: EngineDeps = depsOf(...ABILITIES);

const copies = (id: CardId, n = 2): readonly CardId[] => Array.from({ length: n }, () => id);

function game(...cards: readonly string[]): { state: GameState; ids: readonly InstanceId[] } {
  const state = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: CARDS,
    deck: [...CARDS.flatMap((card) => copies(card.id)), ...copies(RESOURCE.id, 6)],
    deps,
  });
  return giveCards(state, p1, ...cards);
}

const withTokens = (state: GameState, accelerationTokens: number): GameState => ({
  ...state,
  mainScheme: { ...state.mainScheme, accelerationTokens },
});
function withDamage(state: GameState, amount: number): GameState {
  const id = mustPlayer(state, p1).identity.instanceId;
  return { ...state, instances: { ...state.instances, [id]: { ...mustInstance(state, id), damage: amount } } };
}
const yieldOf = (state: GameState, card: InstanceId, payingFor: InstanceId | null = null) =>
  handCardResources(state, deps, card, p1, payingFor);
const play = (card: InstanceId, ...spent: readonly InstanceId[]): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: card,
  payment: spent.map((fromHand) => ({ fromHand })),
  attachToInstanceId: null,
});
const rejected = (state: GameState, command: Command): string => {
  const result = applyCommand(state, command, deps);
  if (result.ok) throw new Error("expected the command to be rejected");
  return result.error.code;
};

describe("§3.80 `additional`: 1 more [wild] for each acceleration token on the main scheme, to 3", () => {
  it("0 tokens: 1 wild; 2 tokens: 3 wilds; 3 tokens: 4 wilds; 5 tokens: still 4", () => {
    const { state, ids } = game("montage");
    const montage = ids[0]!;
    expect(yieldOf(state, montage)).toEqual(poolOf({ wild: 1 }));
    expect(yieldOf(withTokens(state, 2), montage)).toEqual(poolOf({ wild: 3 }));
    expect(yieldOf(withTokens(state, 3), montage)).toEqual(poolOf({ wild: 4 }));
    expect(yieldOf(withTokens(state, 5), montage)).toEqual(poolOf({ wild: 4 }));
  });

  it("the yield is the same whatever the card pays for, and its printed resource stays 1 wild", () => {
    const { state, ids } = game("montage", "cost4");
    const [montage, cost4] = ids as [InstanceId, InstanceId];
    const three = withTokens(state, 3);
    expect(yieldOf(three, montage, cost4)).toEqual(poolOf({ wild: 4 }));
    expect(printedResourcesOf(three, montage, deps)).toEqual(poolOf({ wild: 1 }));
  });

  it("with 3 tokens it pays a cost of 4 alone, and not a cost of 5", () => {
    const { state, ids } = game("montage", "cost4", "cost5");
    const [montage, cost4, cost5] = ids as [InstanceId, InstanceId, InstanceId];
    const three = withTokens(state, 3);
    expect(rejected(three, play(cost5, montage))).toBe("insufficient_resources");
    const played = runWith(deps, three, play(cost4, montage));
    expect(mustPlayer(played, p1).discard).toEqual(expect.arrayContaining([cost4, montage]));
    // With 2 tokens it generates 3, one short.
    expect(rejected(withTokens(state, 2), play(cost4, montage))).toBe("insufficient_resources");
  });
});

describe("§3.80 a `factor` that is a value: double under 5 damage, triple with none", () => {
  it("0 damage: 3 [physical]; 1 and 4 damage: 2; 5 and 9 damage: 1", () => {
    const { state, ids } = game("self");
    const self = ids[0]!;
    expect(yieldOf(withDamage(state, 0), self)).toEqual(poolOf({ physical: 3 }));
    expect(yieldOf(withDamage(state, 1), self)).toEqual(poolOf({ physical: 2 }));
    expect(yieldOf(withDamage(state, 4), self)).toEqual(poolOf({ physical: 2 }));
    expect(yieldOf(withDamage(state, 5), self)).toEqual(poolOf({ physical: 1 }));
    expect(yieldOf(withDamage(state, 9), self)).toEqual(poolOf({ physical: 1 }));
    expect(printedResourcesOf(state, self, deps)).toEqual(poolOf({ physical: 1 }));
  });

  it("is read as the card is spent: undamaged, its 3 and a wild pay a cost of 4; with 1 damage its 2 and a wild do not", () => {
    const { state, ids } = game("self", "cost4", RESOURCE.id);
    const [self, cost4, wild] = ids as [InstanceId, InstanceId, InstanceId];
    const played = runWith(deps, state, play(cost4, self, wild));
    expect(mustPlayer(played, p1).discard).toEqual(expect.arrayContaining([cost4, self, wild]));
    expect(rejected(withDamage(state, 1), play(cost4, self, wild))).toBe("insufficient_resources");
  });

  it("a factor that reads below 0 generates nothing", () => {
    const { state, ids } = game("negative");
    expect(yieldOf(state, ids[0]!)).toEqual(poolOf({}));
  });
});

describe("§3.80 `additional` is added before any multiplier", () => {
  it("the card's own factor counts what it added: [energy][wild] + 1 wild, wilds tripled, is 1 energy and 6 wild", () => {
    const { state, ids } = game("both");
    expect(yieldOf(state, ids[0]!)).toEqual(poolOf({ energy: 1, wild: 6 }));
  });

  it("a doubling on the card paid for counts it too: (1 + 3) wilds doubled is 8, paying a cost of 8", () => {
    const { state, ids } = game("montage", "doubled", "cost4");
    const [montage, doubled, cost4] = ids as [InstanceId, InstanceId, InstanceId];
    const three = withTokens(state, 3);
    expect(yieldOf(three, montage, doubled)).toEqual(poolOf({ wild: 8 }));
    expect(yieldOf(three, montage, cost4)).toEqual(poolOf({ wild: 4 }));
    const played = runWith(deps, three, play(doubled, montage));
    expect(mustPlayer(played, p1).discard).toEqual(expect.arrayContaining([doubled, montage]));
    // With 2 tokens: (1 + 2) doubled is 6, short of 8.
    expect(yieldOf(withTokens(state, 2), montage, doubled)).toEqual(poolOf({ wild: 6 }));
    expect(rejected(withTokens(state, 2), play(doubled, montage))).toBe("insufficient_resources");
  });

  it("and so does the card's own 'while paying for' doubling: (1 + 2) doubled is 6 for that aspect, 3 otherwise", () => {
    const { state, ids } = game("montage-power", "aggro", "cost4");
    const [card, aggro, cost4] = ids as [InstanceId, InstanceId, InstanceId];
    const two = withTokens(state, 2);
    expect(yieldOf(two, card, aggro)).toEqual(poolOf({ wild: 6 }));
    expect(yieldOf(two, card, cost4)).toEqual(poolOf({ wild: 3 }));
  });
});

describe("§3.80 a value as the factor of the card paid for (`forThisCard`)", () => {
  it("reads the payer's table: 1 + the damage on their identity, so a wild pays 1, 3 or 0 extra accordingly", () => {
    const { state, ids } = game("scaling", RESOURCE.id);
    const [scaling, wild] = ids as [InstanceId, InstanceId];
    expect(yieldOf(state, wild, scaling)).toEqual(poolOf({ wild: 1 }));
    expect(yieldOf(withDamage(state, 2), wild, scaling)).toEqual(poolOf({ wild: 3 }));
    expect(rejected(withDamage(state, 1), play(scaling, wild))).toBe("insufficient_resources");
    const played = runWith(deps, withDamage(state, 2), play(scaling, wild));
    expect(mustPlayer(played, p1).discard).toEqual(expect.arrayContaining([scaling, wild]));
  });
});
