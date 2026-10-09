/**
 * docs/phase7-wave8.md §3.62, half (a): the resource types a payment used. `paid.count`; the wilds a player declares
 * (`playCard.wildAs`, the `declareWildTypes` choice and its one shortcut); `readsPaidTypes` and `RuleSpec
 * readsPaymentTypesOf`; `ValueSpec paidTypeCount` and `Predicate paidType`; the payment stamped on `cardPlayed`; the
 * log's `wildTypesDeclared`. Proven with synthetic cards driving real `playCard` commands and choices.
 *
 * Sources: RRG 1.8 "Wild Resource" (p. 48: "When a player generates a wild resource, they may specify which resource
 * type (energy, mental, physical, or wild) it is being used as"), "Cost" (p. 13: resources generated beyond the cost
 * "were not paid for that cost"), "Resource" (p. 37: four types); FAQ "Unstoppable Force (#6)" (p. 60: at a cost of 0
 * nothing was paid); ruling January 17, 2026 - Ruling 4 (1): "you specify which resource type it represents, even when
 * overpaying a cost". Owner decisions §4.1 Q33 = B (the player declares; the engine never picks, and skips the question
 * only when every declaration reads the same), Q34 = A (overpaid resources are not read) and their follow-up (the paid
 * resources are the ones that give the most declared types, with no further prompt).
 *
 * Every probe writes what it read as damage on the villain, so one number names the reading.
 */

import * as content from "@mc/content";
import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance } from "./query.js";
import {
  declaredPool,
  EMPTY_POOL,
  paidAsDeclared,
  paidSetOptionId,
  paidSetsAsDeclared,
  paidTypeCountOf,
  requirementOf,
  wildDeclarationFault,
  wildDeclarations,
  wildTypeOptionId,
  type ResourceType,
} from "./resources.js";
import { evaluate, resolveValue, type EffectContext } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec, Predicate, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession, runCommands } from "./testing/drive.js";
import {
  stubEvent,
  stubMainScheme,
  stubResource,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import {
  DEFAULT_CARDS,
  DEFAULT_DECK,
  defaultPick,
  giveCard,
  giveCards,
  HERO,
  seatIdentities,
} from "./testing/scenario.js";

const p1 = playerId("p1");
const eventTarget: TargetRef = { kind: "eventTarget" };
const villainRef: TargetRef = { kind: "villain" };
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(900000), atk: 0, sch: 0 }] });
const LONG_SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

const TYPES: ValueSpec = { kind: "paidTypeCount" };
const TYPES_OF_THAT_EVENT: ValueSpec = { kind: "paidTypeCount", of: eventTarget };
const times = (value: ValueSpec, n: number): ValueSpec => ({ kind: "scaled", value, times: n });
const atLeast = (left: ValueSpec, n: number): Predicate => ({
  kind: "compare",
  left,
  op: "atLeast",
  right: { kind: "const", value: n },
});
const damage = (amount: number | ValueSpec): EffectSpec => ({
  kind: "dealDamage",
  target: villainRef,
  amount: typeof amount === "number" ? { kind: "const", value: amount } : amount,
});
const ifThen = (condition: Predicate, value: number): EffectSpec => ({ kind: "if", condition, then: [damage(value)] });

/** Firecracker: 4 damage; "if you paid for this card using 2 different resource types", 100 more (its stun). */
const FIRE = stubAbility("fire.action", {
  trigger: { kind: "action" },
  readsPaidTypes: { atLeast: 2 },
  effects: [damage(4), ifThen(atLeast(TYPES, 2), 100)],
});
const FIRECRACKER = stubEvent({ id: "firecracker", cost: 2, abilities: [FIRE.ref] });
const FIRECRACKER_ONE = stubEvent({ id: "firecracker-1", cost: 1, abilities: [FIRE.ref] });
/** The same text with no mark: what a card that ignores types looks like to the engine. */
const FIRE_UNMARKED = stubAbility("fire.action", {
  trigger: { kind: "action" },
  effects: [damage(4), ifThen(atLeast(TYPES, 2), 100)],
});

/** Grand Finale / Blinding Flash: 2 damage, and 2 more "for each different resource type used to pay for this card". */
const GRAND = stubAbility("grand.action", {
  trigger: { kind: "action" },
  readsPaidTypes: { count: true },
  effects: [damage(2), damage(times(TYPES, 2))],
});
const GRAND_FINALE = stubEvent({ id: "grand-finale", cost: 3, abilities: [GRAND.ref] });
/** Three Steps Ahead: a Justice event of cost 3; 1000 "for each different resource type you used to pay". */
const STEPS = stubAbility("steps.action", {
  trigger: { kind: "action" },
  readsPaidTypes: { count: true },
  effects: [damage(times(TYPES, 1000))],
});
const THREE_STEPS = stubEvent({ id: "three-steps", cost: 3, aspect: "justice", abilities: [STEPS.ref] });

/** Multitalented: "at least 1 [physical]": 1; "[mental]": 10; "[energy]": 100. */
const MULTI = stubAbility("multi.action", {
  trigger: { kind: "action" },
  readsPaidTypes: { types: ["physical", "mental", "energy"] },
  effects: [
    ifThen({ kind: "paidType", resource: "physical" }, 1),
    ifThen({ kind: "paidType", resource: "mental" }, 10),
    ifThen({ kind: "paidType", resource: "energy" }, 100),
  ],
});
const MULTITALENTED = stubEvent({ id: "multitalented", cost: 3, abilities: [MULTI.ref] });
const MULTITALENTED_TWO = stubEvent({ id: "multitalented-2", cost: 2, abilities: [MULTI.ref] });

/** Unlikely Duo: an event that reads no types; 1 damage. */
const DUO = stubAbility("duo.action", { trigger: { kind: "action" }, effects: [damage(1)] });
const UNLIKELY_DUO = stubEvent({ id: "unlikely-duo", cost: 2, abilities: [DUO.ref] });

/** "Spend a [physical] resource →" on a cost-1 event that counts types: a typed slot and a generic one. */
const TYPED = stubAbility("typed.action", {
  trigger: { kind: "action" },
  cost: { resources: { physical: 1 } },
  readsPaidTypes: { count: true },
  effects: [damage(times(TYPES, 1000))],
});
const TYPED_ZERO = stubEvent({ id: "typed-0", cost: 0, abilities: [TYPED.ref] });
const TYPED_ONE = stubEvent({ id: "typed-1", cost: 1, abilities: [TYPED.ref] });

/** Jubilee's Sunglasses: the rule, and "after you play an event, 1000 for each type used to pay for that event". */
const SHADES_RULE = stubAbility("shades.constant", {
  trigger: { kind: "constant", rules: [{ kind: "readsPaymentTypesOf", cards: { categories: ["event"] } }] },
  effects: [],
});
const AFTER_YOU_PLAY_AN_EVENT = {
  on: "cardPlayed",
  playerIs: "controller",
  targetIs: { categories: ["event"] },
} as const;
const SHADES_RESPONSE = stubAbility("shades.response", {
  trigger: { kind: "response", forced: true, on: AFTER_YOU_PLAY_AN_EVENT },
  effects: [damage(times(TYPES_OF_THAT_EVENT, 1000))],
});
const SUNGLASSES = stubSupport({ id: "sunglasses", cost: 0, abilities: [SHADES_RULE.ref, SHADES_RESPONSE.ref] });
/** The same rule naming allies: it does not match an event. */
const ALLY_RULE = stubAbility("ally-watch.constant", {
  trigger: { kind: "constant", rules: [{ kind: "readsPaymentTypesOf", cards: { categories: ["ally"] } }] },
  effects: [],
});
const ALLY_WATCH = stubSupport({ id: "ally-watch", cost: 0, abilities: [ALLY_RULE.ref] });
/** Jubilee's Coat as printed: optional, and with nothing to remove it is not offered. */
const COAT_RESPONSE = stubAbility("coat.response", {
  trigger: {
    kind: "response",
    forced: false,
    on: AFTER_YOU_PLAY_AN_EVENT,
    while: atLeast(TYPES_OF_THAT_EVENT, 1),
  },
  effects: [damage(times(TYPES_OF_THAT_EVENT, 1000))],
});
const COAT = stubSupport({ id: "coat", cost: 0, abilities: [SHADES_RULE.ref, COAT_RESPONSE.ref] });
/** Another card's response with no `of`: its own frame paid for nothing. */
const BYSTANDER_RESPONSE = stubAbility("bystander.response", {
  trigger: { kind: "response", forced: true, on: AFTER_YOU_PLAY_AN_EVENT },
  effects: [damage(times(TYPES, 50000)), ifThen({ kind: "paidType", resource: "energy" }, 50000)],
});
const BYSTANDER = stubSupport({ id: "bystander", cost: 0, abilities: [BYSTANDER_RESPONSE.ref] });
/** "When you play an event": 20 for each type that paid for that event, read while the play resolves. */
const WHEN_RESPONSE = stubAbility("when.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: { categories: ["event"] } },
  },
  effects: [damage(times(TYPES_OF_THAT_EVENT, 20))],
});
const WHEN_CARD = stubSupport({ id: "when-card", cost: 0, abilities: [WHEN_RESPONSE.ref] });

/** A response event played from hand inside a window: 7 damage, 700 more if two types paid for it. */
const ECHO_RESPONSE = stubAbility("echo.response", {
  trigger: { kind: "response", forced: false, on: { ...AFTER_YOU_PLAY_AN_EVENT, targetIs: { name: "unlikely-duo" } } },
  readsPaidTypes: { atLeast: 2 },
  effects: [damage(7), ifThen(atLeast(TYPES, 2), 700)],
});
const ECHO = stubEvent({ id: "echo", cost: 2, abilities: [ECHO_RESPONSE.ref] });

/** "Like, totally!" and X-Gene: "Resource: exhaust this card → generate a [wild] resource", on a card in play. */
const BATTERY_RESOURCE = stubAbility("battery.resource", {
  trigger: { kind: "resource" },
  cost: { exhaustSelf: true },
  generates: { wild: 1 },
  effects: [],
});
const BATTERY = stubSupport({ id: "battery", cost: 0, abilities: [BATTERY_RESOURCE.ref] });
const BATTERY_TWO = stubSupport({ id: "battery-two", cost: 0, abilities: [BATTERY_RESOURCE.ref] });

/** "Reduce the cost to play each event by 1." */
const REDUCER_RULE = stubAbility("reducer.constant", {
  trigger: { kind: "constant", costModifiers: [{ delta: -1, appliesTo: { categories: ["event"] } }] },
  effects: [],
});
const REDUCER = stubSupport({ id: "reducer", cost: 0, abilities: [REDUCER_RULE.ref] });

/** The resource cards: Energy, Genius, Strength; Plasmoid Energy 47010a ([energy][mental]); Genius doubled. */
const ENERGY = stubResource({ id: "energy-card", icons: 1, produces: { energy: 1 } });
const MENTAL = stubResource({ id: "mental-card", icons: 1, produces: { mental: 1 } });
const STRENGTH = stubResource({ id: "strength-card", icons: 1, produces: { physical: 1 } });
const PLASMOID = stubResource({ id: "plasmoid", icons: 2, produces: { energy: 1, mental: 1 } });
const GENIUS = stubResource({ id: "genius", icons: 2, produces: { mental: 2 } });
/** Flash of Light 47008c as a paying card: an event with one [physical]. */
const PHYSICAL_EVENT = stubEvent({ id: "physical-event", cost: 9, resourceIcons: { physical: 1 } });
/** The Power of Justice: 1 [wild], doubled while paying for a Justice card. */
const POWER_TEXT = stubAbility("power.constant", {
  trigger: { kind: "constant", resourceMultiplier: { factor: 2, whilePayingFor: { aspect: "justice" } } },
  effects: [],
});
const POWER = stubResource({ id: "power-of-justice", icons: 1, abilities: [POWER_TEXT.ref] });

/** A Core Set ally with its printed data and no script: a card that ignores types. */
const MOCKINGBIRD = content.CORE_CARDS.find((card) => card.name === "Mockingbird" && card.type === "ally");
if (!MOCKINGBIRD) throw new Error("the Core Set has no Mockingbird ally");

const ABILITIES = [
  FIRE,
  GRAND,
  STEPS,
  MULTI,
  DUO,
  TYPED,
  SHADES_RULE,
  SHADES_RESPONSE,
  ALLY_RULE,
  COAT_RESPONSE,
  BYSTANDER_RESPONSE,
  WHEN_RESPONSE,
  ECHO_RESPONSE,
  BATTERY_RESOURCE,
  REDUCER_RULE,
  POWER_TEXT,
];
const deps: EngineDeps = depsOf(...ABILITIES);
const PLAYER_CARDS = [
  FIRECRACKER,
  FIRECRACKER_ONE,
  GRAND_FINALE,
  THREE_STEPS,
  MULTITALENTED,
  MULTITALENTED_TWO,
  UNLIKELY_DUO,
  TYPED_ZERO,
  TYPED_ONE,
  SUNGLASSES,
  ALLY_WATCH,
  COAT,
  BYSTANDER,
  WHEN_CARD,
  ECHO,
  BATTERY,
  BATTERY_TWO,
  REDUCER,
  ENERGY,
  MENTAL,
  STRENGTH,
  PLASMOID,
  GENIUS,
  PHYSICAL_EVENT,
  POWER,
  MOCKINGBIRD,
];
/** Three of each basic resource card and two of the others that pay, so a payment can spend several of a kind. */
const PLAYER_DECK = [
  ...PLAYER_CARDS.map((c) => c.id),
  ...copies(ENERGY.id, 2),
  ...copies(STRENGTH.id, 2),
  MENTAL.id,
  POWER.id,
  FIRECRACKER.id,
];

function game(): GameState {
  const identities = seatIdentities(HERO, 1);
  const result = createGame(
    {
      seed: 8,
      cards: [...DEFAULT_CARDS, QUIET_VILLAIN, LONG_SCHEME, BLANK, ...PLAYER_CARDS, ...identities],
      villainCardId: QUIET_VILLAIN.id,
      mainSchemeCardId: LONG_SCHEME.id,
      encounterDeck: copies(BLANK.id, 16),
      includeIdentitySets: false,
      players: identities.map((identity) => ({
        identityCardId: identity.id,
        deck: [...DEFAULT_DECK, ...PLAYER_DECK],
      })),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return runCommands(result.state, deps).state;
}

const fromHand = (...ids: readonly InstanceId[]): readonly Payment[] => ids.map((id) => ({ fromHand: id }));
const playCard = (
  id: InstanceId,
  payment: readonly Payment[] = [],
  wildAs?: readonly ResourceType[],
): Command & { type: "playCard" } => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment,
  attachToInstanceId: null,
  ...(wildAs ? { wildAs } : {}),
});
const villainDamage = (state: GameState): number =>
  mustInstance(state, state.villains[0]?.instanceId as InstanceId).damage;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const declarationIds = (types: readonly ResourceType[]): readonly string[] =>
  types.map((type, index) => wildTypeOptionId(index, type));

interface Driven {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly session: ReturnType<typeof startSession>;
  /** How many `declareWildTypes` choices were asked. */
  readonly asked: number;
  /** How many `choosePaidResources` choices were asked (owner decision, 2026-10-08, §4.1 row 79). */
  readonly paidAsked: number;
}

type PaidSet = Partial<Record<ResourceType, number>>;
const paidSetId = (paid: PaidSet): string => paidSetOptionId({ ...EMPTY_POOL, ...paid });

/**
 * Applies `commands`, answering each `declareWildTypes` choice with the next of `declarations` (the engine's default
 * when they run out), each `choosePaidResources` choice with the next of `paidSets` (the first set offered when they
 * run out) and every other choice with `other` (the test driver's default).
 */
function drive(
  start: GameState,
  commands: readonly Command[],
  declarations: readonly (readonly ResourceType[])[] = [],
  other: (state: GameState) => readonly string[] = defaultPick,
  testDeps: EngineDeps = deps,
  paidSets: readonly PaidSet[] = [],
): Driven {
  let asked = 0;
  let paidAsked = 0;
  const pick = (state: GameState): readonly string[] => {
    if (state.pendingChoice?.prompt.kind === "choosePaidResources") {
      const paid = paidSets[paidAsked];
      paidAsked += 1;
      return paid ? [paidSetId(paid)] : defaultPick(state);
    }
    if (state.pendingChoice?.prompt.kind !== "declareWildTypes") return other(state);
    const declared = declarations[asked];
    asked += 1;
    return declared ? declarationIds(declared) : defaultPick(state);
  };
  const { session, events } = driveSession(startSession(start), testDeps, commands, pick);
  return { state: session.state, events, session, asked, paidAsked };
}

/** Puts each of `cards` (cost 0) into play, in order. */
function withInPlay(start: GameState, ...cards: readonly CardId[]): { state: GameState; ids: readonly InstanceId[] } {
  let state = start;
  const ids: InstanceId[] = [];
  for (const card of cards) {
    const given = giveCard(state, p1, card, ids);
    state = runCommands(given.state, deps, playCard(given.id)).state;
    ids.push(given.id);
  }
  return { state, ids };
}

const BATTERIES: readonly CardId[] = [BATTERY.id, BATTERY_TWO.id];

interface Paying {
  /** Cards discarded from hand to pay, one of each. */
  readonly cards?: readonly CardId[];
  /** How many of the two wild-generating cards in play pay (0 to 2). */
  readonly wilds?: number;
  /** Other cost-0 cards put into play first. */
  readonly inPlay?: readonly CardId[];
  /** The declaration carried by the command. */
  readonly wildAs?: readonly ResourceType[];
  /** The answers to the `declareWildTypes` choices, in order. */
  readonly declare?: readonly (readonly ResourceType[])[];
  /** The answers to the `choosePaidResources` choices, in order. */
  readonly paid?: readonly PaidSet[];
}

/** Plays `card` with that payment from a fresh game; the result with the villain's damage before it subtracted. */
function playPaying(card: CardId, paying: Paying = {}): Driven & { readonly dealt: number } {
  const batteries = BATTERIES.slice(0, paying.wilds ?? 0);
  const board = withInPlay(game(), ...batteries, ...(paying.inPlay ?? []));
  const given = giveCards(board.state, p1, card, ...(paying.cards ?? []));
  const [played, ...hand] = given.ids as [InstanceId, ...InstanceId[]];
  const payment: readonly Payment[] = [
    ...batteries.map((_, index) => ({
      ability: { instanceId: board.ids[index] as InstanceId, abilityId: BATTERY_RESOURCE.ref.id },
    })),
    ...fromHand(...hand),
  ];
  const before = villainDamage(given.state);
  const run = drive(
    given.state,
    [playCard(played, payment, paying.wildAs)],
    paying.declare,
    defaultPick,
    deps,
    paying.paid,
  );
  // The payment was accepted whole: every paying card left the hand, overpaid ones included.
  for (const id of hand) expect(run.state.players[0]?.hand).not.toContain(id);
  return { ...run, dealt: villainDamage(run.state) - before };
}

describe("§3.62 the declared types of a payment (pure)", () => {
  const pool = (parts: Partial<Record<ResourceType, number>>) => ({ ...EMPTY_POOL, ...parts });

  it("declaredPool: each wild counts as the type it was declared, or stays a wild", () => {
    expect(declaredPool(pool({ physical: 1, wild: 2 }), ["energy", "wild"])).toEqual(
      pool({ physical: 1, energy: 1, wild: 1 }),
    );
  });

  it("paidAsDeclared: as many resources as the cost took, the ones that give the most types", () => {
    // [energy][mental][physical][physical] toward 3: one of each, the second [physical] overpaid.
    expect(paidAsDeclared(pool({ energy: 1, mental: 1, physical: 2 }), requirementOf(3))).toEqual(
      pool({ energy: 1, mental: 1, physical: 1 }),
    );
    // Three [energy] toward 3: one type.
    expect(paidTypeCountOf(paidAsDeclared(pool({ energy: 3 }), requirementOf(3))!)).toBe(1);
    // Four types generated, three paid: three types, never four (§4.1 Q34 = A).
    expect(
      paidTypeCountOf(paidAsDeclared(pool({ energy: 1, mental: 1, physical: 1, wild: 1 }), requirementOf(3))!),
    ).toBe(3);
    // A cost of 0: nothing was paid (FAQ "Unstoppable Force (#6)", p. 60).
    expect(paidAsDeclared(pool({ energy: 1 }), requirementOf(0))).toEqual(EMPTY_POOL);
    // A typed slot takes its own type first; the generic slot then takes a type not yet paid.
    expect(paidAsDeclared(pool({ physical: 2, energy: 1 }), requirementOf({ physical: 1, generic: 1 }))).toEqual(
      pool({ physical: 1, energy: 1 }),
    );
    // Declared so that the cost is no longer paid: no paid set.
    expect(paidAsDeclared(pool({ energy: 2 }), requirementOf({ physical: 1 }))).toBeNull();
  });

  it("paidSetsAsDeclared: every set with the most types, `paidAsDeclared`'s first", () => {
    // One of each toward 2: three sets of two types.
    expect(paidSetsAsDeclared(pool({ physical: 1, mental: 1, energy: 1 }), requirementOf(2))).toEqual([
      pool({ physical: 1, mental: 1 }),
      pool({ physical: 1, energy: 1 }),
      pool({ mental: 1, energy: 1 }),
    ]);
    // Two [physical] and an [energy] toward 2: two [physical] is one type, so it is no candidate (§4.1 Q34 = A).
    expect(paidSetsAsDeclared(pool({ physical: 2, energy: 1 }), requirementOf(2))).toEqual([
      pool({ physical: 1, energy: 1 }),
    ]);
    // A typed slot is filled with its own type in every set.
    expect(
      paidSetsAsDeclared(pool({ physical: 1, mental: 1, energy: 1 }), requirementOf({ energy: 1, generic: 1 })),
    ).toEqual([pool({ physical: 1, energy: 1 }), pool({ mental: 1, energy: 1 })]);
    // Nothing overpaid, a cost of 0, and a pool that does not pay: one set, the empty set, none.
    expect(paidSetsAsDeclared(pool({ physical: 2 }), requirementOf(2))).toEqual([pool({ physical: 2 })]);
    expect(paidSetsAsDeclared(pool({ physical: 2 }), requirementOf(0))).toEqual([EMPTY_POOL]);
    expect(paidSetsAsDeclared(pool({ energy: 2 }), requirementOf({ physical: 1 }))).toEqual([]);
  });

  it("wildDeclarations: every way to declare interchangeable wilds, all left wild first", () => {
    expect(wildDeclarations(0)).toEqual([[]]);
    expect(wildDeclarations(1)).toEqual([["wild"], ["physical"], ["mental"], ["energy"]]);
    // (2 + 3 choose 3) = 10, not 16: [energy] then [mental] reads as [mental] then [energy].
    expect(wildDeclarations(2)).toHaveLength(10);
    expect(wildDeclarations(2)[0]).toEqual(["wild", "wild"]);
    expect(wildDeclarations(3)).toHaveLength(20);
  });

  it("wildDeclarationFault: one type per wild, and the cost still paid as declared", () => {
    const oneWild = pool({ wild: 1 });
    expect(wildDeclarationFault(oneWild, ["energy"], requirementOf(1))).toBeNull();
    expect(wildDeclarationFault(oneWild, [], requirementOf(1))).toMatch(/1 generated, 0 declared/);
    expect(wildDeclarationFault(oneWild, ["energy", "mental"], requirementOf(1))).toMatch(/1 generated, 2 declared/);
    expect(wildDeclarationFault(oneWild, ["bogus" as ResourceType], requirementOf(1))).toMatch(/not a resource type/);
    // "Spend a [physical] resource" paid with a wild: the wild is the [physical].
    expect(wildDeclarationFault(oneWild, ["physical"], requirementOf({ physical: 1 }))).toBeNull();
    expect(wildDeclarationFault(oneWild, ["energy"], requirementOf({ physical: 1 }))).toMatch(/needs 1 physical/);
    expect(wildDeclarationFault(oneWild, ["wild"], requirementOf({ physical: 1 }))).toMatch(/needs 1 physical/);
    // "Spend a [wild] resource" takes a wild left wild (RRG 1.8 "Wild Resource", p. 48).
    expect(wildDeclarationFault(oneWild, ["wild"], requirementOf({ wild: 1 }))).toBeNull();
    expect(wildDeclarationFault(oneWild, ["energy"], requirementOf({ wild: 1 }))).toMatch(/needs 1 wild/);
    // "You can only spend [physical] resources to pay for this card."
    expect(wildDeclarationFault(oneWild, ["energy"], requirementOf(1), ["physical"])).toMatch(/only physical/);
    expect(wildDeclarationFault(oneWild, ["wild"], requirementOf(1), ["physical"])).toBeNull();
  });
});

describe("§3.62 test 1: typed resources need no declaration", () => {
  it("Firecracker (cost 2) paid with [energy][mental] on one card: 4 damage and the stun; nothing asked", () => {
    const run = playPaying(FIRECRACKER.id, { cards: [PLASMOID.id] });
    expect(run.dealt).toBe(104);
    expect(run.asked).toBe(0);
    // No wild was generated: nothing is declared, and nothing is logged as declared.
    expect(ofType(run.events, "wildTypesDeclared")).toEqual([]);
    expect(ofType(run.events, "cardPlayed")[0]).toMatchObject({
      resourcesPaid: 2,
      paidCount: 2,
      paidAs: { physical: 0, mental: 1, energy: 1, wild: 0 },
    });
  });

  it("paid with two [physical] cards: one type, no stun", () => {
    expect(playPaying(FIRECRACKER.id, { cards: [STRENGTH.id, STRENGTH.id] })).toMatchObject({ dealt: 4, asked: 0 });
  });

  it("paid with a double-resource card of one type ([mental][mental]): one type, no stun", () => {
    expect(playPaying(FIRECRACKER.id, { cards: [GENIUS.id] })).toMatchObject({ dealt: 4, asked: 0 });
  });
});

describe("§3.62 test 2 (Q33 = B): the player declares a wild", () => {
  const wildAndPhysical = { wilds: 1, cards: [PHYSICAL_EVENT.id] };

  it("a wild from a card in play and a [physical] card: she is asked, with four options and none preselected", () => {
    const board = withInPlay(game(), BATTERY.id);
    const given = giveCards(board.state, p1, FIRECRACKER.id, PHYSICAL_EVENT.id);
    const [fire, physical] = given.ids as [InstanceId, InstanceId];
    const battery = { ability: { instanceId: board.ids[0] as InstanceId, abilityId: BATTERY_RESOURCE.ref.id } };
    const result = applyCommand(given.state, playCard(fire, [battery, ...fromHand(physical)]), deps);
    if (!result.ok) throw new Error(result.error.message);
    const choice = result.state.pendingChoice;
    expect(choice?.playerId).toBe(p1);
    expect(choice?.prompt).toEqual({
      kind: "declareWildTypes",
      instanceId: fire,
      wilds: 1,
      pool: { physical: 1, mental: 0, energy: 0, wild: 1 },
      requirement: { generic: 2, physical: 0, mental: 0, energy: 0 },
    });
    expect(choice?.options.map((o) => o.optionId)).toEqual(["0:energy", "0:mental", "0:physical", "0:wild"]);
    expect([choice?.minSelections, choice?.maxSelections]).toEqual([1, 1]);
    // The card is paid for and waiting: nothing of it has resolved before the declaration.
    expect(villainDamage(result.state)).toBe(villainDamage(given.state));
    expect(mustInstance(result.state, board.ids[0] as InstanceId).exhausted).toBe(true);
    // The log says the payment is read and that its types are not settled yet.
    const played = ofType(result.events, "cardPlayed")[0];
    expect(played).toMatchObject({ paidCount: 2 });
    expect(played).not.toHaveProperty("paidAs");
    expect(ofType(result.events, "wildTypesDeclared")).toEqual([]);
  });

  it.each([
    ["energy", 104],
    ["mental", 104],
    ["wild", 104],
    ["physical", 4],
  ] as const)("declared [%s]: %i", (type, dealt) => {
    const run = playPaying(FIRECRACKER.id, { ...wildAndPhysical, declare: [[type]] });
    expect(run).toMatchObject({ dealt, asked: 1 });
    const paidAs = { ...EMPTY_POOL, physical: 1 };
    paidAs[type] += 1;
    expect(ofType(run.events, "wildTypesDeclared")).toEqual([
      {
        type: "wildTypesDeclared",
        playerId: p1,
        instanceId: expect.any(String),
        declared: [type],
        skipped: false,
        paidAs,
      },
    ]);
  });

  it.each([
    [["energy", "mental"], 104],
    [["wild", "energy"], 104],
    [["physical", "wild"], 104],
    [["energy", "energy"], 4],
    [["wild", "wild"], 4],
  ] as const)("two wilds from two cards in play, declared %j: %i", (declared, dealt) => {
    const run = playPaying(FIRECRACKER.id, { wilds: 2, declare: [declared] });
    expect(run).toMatchObject({ dealt, asked: 1 });
    expect(run.state.pendingChoice).toBeNull();
  });

  it("two wilds: eight options, two selections", () => {
    const board = withInPlay(game(), ...BATTERIES);
    const given = giveCard(board.state, p1, FIRECRACKER.id);
    const payment = board.ids.map((instanceId) => ({ ability: { instanceId, abilityId: BATTERY_RESOURCE.ref.id } }));
    const result = applyCommand(given.state, playCard(given.id, payment), deps);
    if (!result.ok) throw new Error(result.error.message);
    const choice = result.state.pendingChoice;
    expect(choice?.options.map((o) => o.optionId)).toEqual([
      "0:energy",
      "0:mental",
      "0:physical",
      "0:wild",
      "1:energy",
      "1:mental",
      "1:physical",
      "1:wild",
    ]);
    expect([choice?.minSelections, choice?.maxSelections]).toEqual([2, 2]);
  });
});

describe("§3.62 tests 3, 4 and 6 (Q34 = A): overpaid resources are not read", () => {
  it("Grand Finale (cost 3) paid with [energy][mental] and [physical]: three types, 2 + 2 + 2 + 2", () => {
    const run = playPaying(GRAND_FINALE.id, { cards: [PLASMOID.id, PHYSICAL_EVENT.id] });
    expect(run).toMatchObject({ dealt: 8, asked: 0 });
  });

  it("with a second [physical] card: four resources, three paid, three types", () => {
    const run = playPaying(GRAND_FINALE.id, { cards: [PLASMOID.id, PHYSICAL_EVENT.id, STRENGTH.id] });
    expect(run).toMatchObject({ dealt: 8, asked: 0 });
    expect(ofType(run.events, "cardPlayed")[0]).toMatchObject({
      resourcesPaid: 4,
      paidCount: 3,
      paidAs: { physical: 1, mental: 1, energy: 1, wild: 0 },
    });
  });

  it("with a wild card instead: four types generated, three paid: 8 damage, not 10, and nothing asked", () => {
    const run = playPaying(GRAND_FINALE.id, { cards: [PLASMOID.id, PHYSICAL_EVENT.id, POWER.id] });
    expect(run).toMatchObject({ dealt: 8, asked: 0 });
    // Three types whatever the wild is called, so it is left a wild and the log says the question was skipped.
    expect(ofType(run.events, "wildTypesDeclared")).toEqual([
      expect.objectContaining({
        declared: ["wild"],
        skipped: true,
        paidAs: { physical: 1, mental: 1, energy: 1, wild: 0 },
      }),
    ]);
  });

  it("a cost of 3 reads at most three types: paid with three [energy], X is 1", () => {
    const run = playPaying(GRAND_FINALE.id, { cards: [ENERGY.id, ENERGY.id, ENERGY.id] });
    expect(run).toMatchObject({ dealt: 4, asked: 0 });
  });

  it("the follow-up: an overpaid payment with a real choice asks once, then takes the set with the most types", () => {
    // Cost 2, [physical] [physical] and a wild: three resources, two paid.
    const paying = { wilds: 1, cards: [STRENGTH.id, STRENGTH.id] };
    // Declared [physical]: three [physical], one type. Declared anything else: it is one of the two paid.
    expect(playPaying(FIRECRACKER.id, { ...paying, declare: [["physical"]] })).toMatchObject({ dealt: 4, asked: 1 });
    const run = playPaying(FIRECRACKER.id, { ...paying, declare: [["mental"]] });
    expect(run).toMatchObject({ dealt: 104, asked: 1 });
    expect(ofType(run.events, "wildTypesDeclared")[0]).toMatchObject({
      declared: ["mental"],
      paidAs: { physical: 1, mental: 1, energy: 0, wild: 0 },
    });
    expect(run.state.pendingChoice).toBeNull();
  });

  it("paid.count and the overpaid part travel with the play, while it resolves and on its announcement", () => {
    const board = withInPlay(game(), WHEN_CARD.id, SUNGLASSES.id);
    const given = giveCards(board.state, p1, GRAND_FINALE.id, PLASMOID.id, PHYSICAL_EVENT.id, STRENGTH.id);
    const [grand, ...hand] = given.ids as [InstanceId, ...InstanceId[]];
    const before = villainDamage(given.state);
    const run = drive(given.state, [playCard(grand, fromHand(...hand))]);
    // The interrupt's 20 for each of three types, Grand Finale's 8, the response's 1000 for each of three.
    expect(villainDamage(run.state) - before).toBe(60 + 8 + 3000);
    const announced = run.events.flatMap((e) =>
      e.type === "windowOpened" && e.event.kind === "cardPlayed" && e.event.instanceId === grand ? [e.event] : [],
    );
    expect(announced[0]?.payment).toMatchObject({
      "paid.count": 3,
      "paid.total": 4,
      "overpaid.total": 1,
      "paid.as.physical": 1,
      "paid.as.mental": 1,
      "paid.as.energy": 1,
    });
  });
});

describe("§3.62 test 5: two wilds from one doubled card, declared one by one", () => {
  const paying = { cards: [POWER.id, ENERGY.id] };

  it.each([
    [["mental", "physical"], 3000],
    [["mental", "wild"], 3000],
    [["wild", "physical"], 3000],
    [["energy", "mental"], 2000],
    [["energy", "energy"], 1000],
    [["wild", "wild"], 2000],
  ] as const)("Three Steps Ahead paid with 2 [wild] and [energy], declared %j: %i", (declared, dealt) => {
    const run = playPaying(THREE_STEPS.id, { ...paying, declare: [declared] });
    expect(run).toMatchObject({ dealt, asked: 1 });
  });
});

describe("§3.62 tests 7 and 12: a reader in play (`readsPaymentTypesOf`)", () => {
  it("an event paid with [energy] and [mental]: its own reading, then the response reads two types of that event", () => {
    const run = playPaying(FIRECRACKER.id, { cards: [ENERGY.id, MENTAL.id], inPlay: [SUNGLASSES.id] });
    expect(run).toMatchObject({ dealt: 104 + 2000, asked: 0 });
  });

  it("an event that reads no types, paid with a wild and [physical]: she is asked because the Sunglasses read it", () => {
    const paying = { wilds: 1, cards: [STRENGTH.id], inPlay: [SUNGLASSES.id] };
    expect(playPaying(UNLIKELY_DUO.id, { ...paying, declare: [["energy"]] })).toMatchObject({ dealt: 2001, asked: 1 });
    expect(playPaying(UNLIKELY_DUO.id, { ...paying, declare: [["physical"]] })).toMatchObject({
      dealt: 1001,
      asked: 1,
    });
  });

  it("without the Sunglasses in play the same payment asks nothing and records no types", () => {
    const run = playPaying(UNLIKELY_DUO.id, { wilds: 1, cards: [STRENGTH.id] });
    expect(run).toMatchObject({ dealt: 1, asked: 0 });
    expect(ofType(run.events, "wildTypesDeclared")).toEqual([]);
    expect(ofType(run.events, "cardPlayed")[0]).not.toHaveProperty("paidCount");
    expect(ofType(run.events, "cardPlayed")[0]).not.toHaveProperty("paidAs");
  });

  it("a rule that names other cards does not make the payment one that is read", () => {
    const run = playPaying(UNLIKELY_DUO.id, { wilds: 1, cards: [STRENGTH.id], inPlay: [ALLY_WATCH.id] });
    expect(run).toMatchObject({ dealt: 1, asked: 0 });
    expect(ofType(run.events, "wildTypesDeclared")).toEqual([]);
  });

  it("the play's `cardPlayed` event carries the payment, and the response reads it from the event alone", () => {
    const run = playPaying(UNLIKELY_DUO.id, {
      wilds: 1,
      cards: [STRENGTH.id],
      inPlay: [SUNGLASSES.id],
      declare: [["energy"]],
    });
    const announced = run.events.flatMap((e) =>
      e.type === "windowOpened" && e.event.kind === "cardPlayed" && e.event.payment ? [e.event] : [],
    );
    const event = announced[announced.length - 1];
    expect(event?.payment).toMatchObject({
      "paid.count": 2,
      "paid.total": 2,
      "paid.physical": 1,
      "paid.wild": 1,
      "paid.as.physical": 1,
      "paid.as.energy": 1,
      "overpaid.total": 0,
    });
    expect(event?.payment).not.toHaveProperty("paid.as.wild");
    // The play has left the stack: nothing but the event names the payment.
    expect(run.state.stack).toEqual([]);
    const context: EffectContext = {
      selfInstanceId: null,
      controllerId: p1,
      event: event ?? null,
      bindings: {},
      deps,
    };
    expect(resolveValue(run.state, TYPES_OF_THAT_EVENT, context)).toBe(2);
    expect(evaluate(run.state, { kind: "paidType", resource: "energy", of: eventTarget }, context)).toBe(true);
    expect(evaluate(run.state, { kind: "paidType", resource: "mental", of: eventTarget }, context)).toBe(false);
    // Without `of` the same context reads its own vars, and it has none.
    expect(resolveValue(run.state, TYPES, context)).toBe(0);
    // An event that is not this play's reads nothing.
    const other: EffectContext = { ...context, event: event ? { ...event, payment: {} } : null };
    expect(resolveValue(run.state, TYPES_OF_THAT_EVENT, other)).toBe(0);
  });

  it("an unrelated card's response, reading without `of`, reads nothing: its own frame paid for nothing", () => {
    const run = playPaying(FIRECRACKER.id, { cards: [ENERGY.id, MENTAL.id], inPlay: [BYSTANDER.id] });
    expect(run).toMatchObject({ dealt: 104, asked: 0 });
  });

  it("an interrupt to the play reads the play in progress through `of`", () => {
    // The rule is what makes a card in play a reader; an interrupt with no rule beside it reads a marked card's types.
    const run = playPaying(FIRECRACKER.id, { cards: [ENERGY.id, MENTAL.id], inPlay: [WHEN_CARD.id] });
    expect(run).toMatchObject({ dealt: 104 + 40, asked: 0 });
  });
});

describe("§3.62 test 8: a cost reduced to 0", () => {
  it("Firecracker at a cost of 0, Energy discarded anyway: 4 damage, no stun, nothing asked", () => {
    const run = playPaying(FIRECRACKER_ONE.id, { cards: [ENERGY.id], inPlay: [REDUCER.id] });
    expect(run).toMatchObject({ dealt: 4, asked: 0 });
    expect(ofType(run.events, "cardPlayed")[0]).toMatchObject({ resourcesPaid: 1, paidCount: 0, paidAs: EMPTY_POOL });
  });

  it("at a cost of 0 a wild pays for nothing: no declaration can matter, so none is asked", () => {
    const run = playPaying(FIRECRACKER_ONE.id, { wilds: 1, cards: [STRENGTH.id], inPlay: [REDUCER.id] });
    expect(run).toMatchObject({ dealt: 4, asked: 0 });
    expect(ofType(run.events, "wildTypesDeclared")[0]).toMatchObject({ declared: ["wild"], skipped: true });
  });

  it("a forced reader in play reads 0 types of it", () => {
    const run = playPaying(FIRECRACKER_ONE.id, { cards: [ENERGY.id], inPlay: [REDUCER.id, SUNGLASSES.id] });
    expect(run).toMatchObject({ dealt: 4, asked: 0 });
  });

  it("an optional response with nothing to do is not offered; at a cost of 1 it is", () => {
    const offered = (inPlay: readonly CardId[]): boolean => {
      const run = playPaying(FIRECRACKER_ONE.id, { cards: [ENERGY.id], inPlay });
      return ofType(run.events, "choiceRequested").some((e) => e.choice.prompt.kind === "chooseTriggers");
    };
    expect(offered([REDUCER.id, COAT.id])).toBe(false);
    expect(offered([COAT.id])).toBe(true);
  });
});

describe("§3.62 test 9: named types read together (`paidType`)", () => {
  const twoPhysicalAndAWild = { wilds: 1, cards: [STRENGTH.id, STRENGTH.id] };

  it.each([
    ["mental", 11],
    ["energy", 101],
    ["physical", 1],
    ["wild", 1],
  ] as const)("Multitalented paid with two [physical] and a wild declared [%s]: %i", (type, dealt) => {
    expect(playPaying(MULTITALENTED.id, { ...twoPhysicalAndAWild, declare: [[type]] })).toMatchObject({
      dealt,
      asked: 1,
    });
  });

  it("paid with one card of each type: all three lines, nothing asked", () => {
    const run = playPaying(MULTITALENTED.id, { cards: [STRENGTH.id, MENTAL.id, ENERGY.id] });
    expect(run).toMatchObject({ dealt: 111, asked: 0 });
  });

  // Before 2026-10-08 nothing was asked here: the fixed order took the three typed resources and overpaid the wild.
  // The wild left a wild can be one of the three paid, in place of a typed resource, and that silences a line, so the
  // declaration matters and so does the paid set (owner decision, §4.1 row 79).
  it("one of each type and a wild: declared a type it changes nothing; left a wild she says which three paid", () => {
    const paying = { wilds: 1, cards: [STRENGTH.id, MENTAL.id, ENERGY.id] };
    // Declared [physical]: the only three-type set is one of each, so nothing more is asked.
    expect(playPaying(MULTITALENTED.id, { ...paying, declare: [["physical"]] })).toMatchObject({
      dealt: 111,
      asked: 1,
      paidAsked: 0,
    });
    // Left a wild: four sets of three types. The first offered is the three typed resources.
    const typed = playPaying(MULTITALENTED.id, { ...paying, declare: [["wild"]] });
    expect(typed).toMatchObject({ dealt: 111, asked: 1, paidAsked: 1 });
    // The wild in place of the [energy]: the [energy] line does not fire.
    const wildPaid = playPaying(MULTITALENTED.id, {
      ...paying,
      declare: [["wild"]],
      paid: [{ physical: 1, mental: 1, wild: 1 }],
    });
    expect(wildPaid).toMatchObject({ dealt: 11, asked: 1, paidAsked: 1 });
  });

  it("three wilds: one line for each type she declares", () => {
    const board = withInPlay(game(), ...BATTERIES);
    const given = giveCards(board.state, p1, MULTITALENTED.id, POWER.id);
    const [multi, power] = given.ids as [InstanceId, InstanceId];
    const payment: readonly Payment[] = [
      ...board.ids.map((instanceId) => ({ ability: { instanceId, abilityId: BATTERY_RESOURCE.ref.id } })),
      ...fromHand(power),
    ];
    const before = villainDamage(given.state);
    const all = drive(given.state, [playCard(multi, payment)], [["physical", "mental", "energy"]]);
    expect(villainDamage(all.state) - before).toBe(111);
    const none = drive(given.state, [playCard(multi, payment)], [["wild", "wild", "wild"]]);
    expect(villainDamage(none.state) - before).toBe(0);
  });

  // Before 2026-10-08 the fixed order physical, mental, energy, wild decided, with no prompt: always 11.
  describe("more types than the cost took: she says which resources were paid (owner decision, §4.1 row 79)", () => {
    // Cost 2 paid with one card of each type: two resources paid, so two lines, never three (§4.1 Q34 = A; RRG 1.8
    // "Cost", p. 13: the third "was not paid", and no official source says which the third is).
    const oneOfEach = { cards: [STRENGTH.id, MENTAL.id, ENERGY.id] };

    it.each([
      [{ physical: 1, mental: 1 }, 11],
      [{ physical: 1, energy: 1 }, 101],
      [{ mental: 1, energy: 1 }, 110],
    ] as const)("Multitalented at a cost of 2, paid %o: %i", (paid, dealt) => {
      const run = playPaying(MULTITALENTED_TWO.id, { ...oneOfEach, paid: [paid] });
      expect(run).toMatchObject({ dealt, asked: 0, paidAsked: 1 });
      expect(ofType(run.events, "paidResourcesChosen")).toEqual([
        expect.objectContaining({ paidAs: { ...EMPTY_POOL, ...paid } }),
      ]);
      // No wild was generated, so no wild declaration is logged.
      expect(ofType(run.events, "wildTypesDeclared")).toEqual([]);
    });

    it("the choice: asked of the paying player before the card resolves, one option for each set, none preselected", () => {
      const given = giveCards(game(), p1, MULTITALENTED_TWO.id, STRENGTH.id, MENTAL.id, ENERGY.id);
      const [multi, ...hand] = given.ids as [InstanceId, ...InstanceId[]];
      const before = villainDamage(given.state);
      const result = applyCommand(given.state, playCard(multi, fromHand(...hand)), deps);
      if (!result.ok) throw new Error(result.error.message);
      const choice = result.state.pendingChoice;
      expect(choice).toMatchObject({
        playerId: p1,
        minSelections: 1,
        maxSelections: 1,
        prompt: {
          kind: "choosePaidResources",
          instanceId: multi,
          pool: { physical: 1, mental: 1, energy: 1, wild: 0 },
          paidCount: 2,
          sets: [
            { physical: 1, mental: 1, energy: 0, wild: 0 },
            { physical: 1, mental: 0, energy: 1, wild: 0 },
            { physical: 0, mental: 1, energy: 1, wild: 0 },
          ],
        },
      });
      expect(choice?.options.map((option) => option.optionId)).toEqual([
        "physical:1,mental:1,energy:0,wild:0",
        "physical:1,mental:0,energy:1,wild:0",
        "physical:0,mental:1,energy:1,wild:0",
      ]);
      // The payment is spent and nothing of the card has resolved.
      for (const id of hand) expect(result.state.players[0]?.hand).not.toContain(id);
      expect(villainDamage(result.state)).toBe(before);
      // A set that is not offered (all three, or two of one type) is refused and the choice stays open.
      const answer = (optionId: string): Command => ({
        type: "resolveChoice",
        playerId: p1,
        choiceId: choice!.choiceId,
        selectedOptionIds: [optionId],
      });
      expect(applyCommand(result.state, answer("physical:1,mental:1,energy:1,wild:0"), deps).ok).toBe(false);
      expect(applyCommand(result.state, answer("physical:2,mental:0,energy:0,wild:0"), deps).ok).toBe(false);
    });

    it("every set reads the same: nobody is asked (a count reader, and a line reader whose lines are all filled)", () => {
      // Firecracker counts types: [physical][mental][energy] toward 2 is two types whichever two paid.
      const counted = playPaying(FIRECRACKER.id, oneOfEach);
      expect(counted).toMatchObject({ dealt: 104, asked: 0, paidAsked: 0 });
      expect(ofType(counted.events, "paidResourcesChosen")).toEqual([]);
      // Multitalented at its printed cost of 3 with a second [physical]: one of each is the only three-type set.
      const filled = playPaying(MULTITALENTED.id, { cards: [STRENGTH.id, STRENGTH.id, MENTAL.id, ENERGY.id] });
      expect(filled).toMatchObject({ dealt: 111, asked: 0, paidAsked: 0 });
    });

    it("with the wilds declared on the command, only the paid set is asked", () => {
      // [physical], [mental] and a wild declared [energy] toward 2.
      const run = playPaying(MULTITALENTED_TWO.id, {
        wilds: 1,
        cards: [STRENGTH.id, MENTAL.id],
        wildAs: ["energy"],
        paid: [{ mental: 1, energy: 1 }],
      });
      expect(run).toMatchObject({ dealt: 110, asked: 0, paidAsked: 1 });
      expect(ofType(run.events, "wildTypesDeclared")).toEqual([
        expect.objectContaining({
          declared: ["energy"],
          skipped: false,
          paidAs: { ...EMPTY_POOL, mental: 1, energy: 1 },
        }),
      ]);
    });

    it("the answer replays", () => {
      const run = playPaying(MULTITALENTED_TWO.id, { ...oneOfEach, paid: [{ mental: 1, energy: 1 }] });
      const replayed = replay(run.session.log, deps);
      if (!replayed.ok) throw new Error(replayed.error.message);
      expect(replayed.state).toEqual(run.state);
      expect(ofType(replayed.events, "paidResourcesChosen")).toHaveLength(1);
    });
  });
});

describe("§3.62 test 11 (Q33 = B): the one shortcut", () => {
  it("one wild alone pays for a card that only counts: nothing asked, one type, no stun", () => {
    const run = playPaying(FIRECRACKER_ONE.id, { wilds: 1 });
    expect(run).toMatchObject({ dealt: 4, asked: 0 });
    expect(ofType(run.events, "wildTypesDeclared")).toEqual([
      {
        type: "wildTypesDeclared",
        playerId: p1,
        instanceId: expect.any(String),
        declared: ["wild"],
        skipped: true,
        paidAs: { ...EMPTY_POOL, wild: 1 },
      },
    ]);
  });

  it("the near-identical case where it does not apply: the same wild beside a [physical] card is asked", () => {
    // One answer ([energy], [mental] or left wild) is plainly best. She is asked all the same.
    const board = withInPlay(game(), BATTERY.id);
    const given = giveCards(board.state, p1, FIRECRACKER.id, STRENGTH.id);
    const [fire, strength] = given.ids as [InstanceId, InstanceId];
    const battery = { ability: { instanceId: board.ids[0] as InstanceId, abilityId: BATTERY_RESOURCE.ref.id } };
    const result = applyCommand(given.state, playCard(fire, [battery, ...fromHand(strength)]), deps);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.pendingChoice?.prompt.kind).toBe("declareWildTypes");
  });

  it("no wild generated: nothing asked", () => {
    expect(playPaying(FIRECRACKER.id, { cards: [ENERGY.id, MENTAL.id] })).toMatchObject({ dealt: 104, asked: 0 });
  });

  it("Grand Finale paid with [energy][mental], [physical] and a wild from a card in play: three types whatever the wild is called", () => {
    const run = playPaying(GRAND_FINALE.id, { wilds: 1, cards: [PLASMOID.id, PHYSICAL_EVENT.id] });
    expect(run).toMatchObject({ dealt: 8, asked: 0 });
  });

  it("the same wild is asked about when the count can still change: Grand Finale with [energy][mental] and a wild", () => {
    const paying = { wilds: 1, cards: [PLASMOID.id] };
    expect(playPaying(GRAND_FINALE.id, { ...paying, declare: [["energy"]] })).toMatchObject({ dealt: 6, asked: 1 });
    expect(playPaying(GRAND_FINALE.id, { ...paying, declare: [["physical"]] })).toMatchObject({ dealt: 8, asked: 1 });
  });

  it("a wild a typed slot needs has one legal declaration: it is that type, and nothing is asked", () => {
    // "Spend a [physical] resource" paid with the wild alone.
    const run = playPaying(TYPED_ZERO.id, { wilds: 1 });
    expect(run).toMatchObject({ dealt: 1000, asked: 0 });
    expect(ofType(run.events, "wildTypesDeclared")[0]).toMatchObject({
      declared: ["physical"],
      skipped: true,
      paidAs: { ...EMPTY_POOL, physical: 1 },
    });
  });
});

describe("§3.62 the declaration on the command (`wildAs`)", () => {
  it("given up front: no prompt, and it is the player's own declaration in the log", () => {
    const run = playPaying(FIRECRACKER.id, { wilds: 1, cards: [STRENGTH.id], wildAs: ["energy"] });
    expect(run).toMatchObject({ dealt: 104, asked: 0 });
    expect(ofType(run.events, "choiceRequested")).toEqual([]);
    expect(ofType(run.events, "wildTypesDeclared")).toEqual([
      {
        type: "wildTypesDeclared",
        playerId: p1,
        instanceId: expect.any(String),
        declared: ["energy"],
        skipped: false,
        paidAs: { physical: 1, mental: 0, energy: 1, wild: 0 },
      },
    ]);
    expect(ofType(run.events, "cardPlayed")[0]).toMatchObject({
      paidCount: 2,
      paidAs: { physical: 1, mental: 0, energy: 1, wild: 0 },
    });
  });

  it("the engine does not improve on it: declared [physical] beside a [physical] card is one type", () => {
    const run = playPaying(FIRECRACKER.id, { wilds: 1, cards: [STRENGTH.id], wildAs: ["physical"] });
    expect(run).toMatchObject({ dealt: 4, asked: 0 });
  });

  it("given where the engine would have skipped the question: the declaration stands as given", () => {
    const run = playPaying(FIRECRACKER_ONE.id, { wilds: 1, wildAs: ["mental"] });
    expect(run).toMatchObject({ dealt: 4, asked: 0 });
    expect(ofType(run.events, "wildTypesDeclared")[0]).toMatchObject({ declared: ["mental"], skipped: false });
  });

  it("legal on a payment nothing reads: accepted, and nothing is recorded", () => {
    const run = playPaying(UNLIKELY_DUO.id, { wilds: 1, cards: [STRENGTH.id], wildAs: ["energy"] });
    expect(run).toMatchObject({ dealt: 1, asked: 0 });
    expect(ofType(run.events, "wildTypesDeclared")).toEqual([]);
  });

  describe("an illegal declaration is refused and nothing is paid", () => {
    function refused(card: CardId, paying: Paying): string {
      const batteries = BATTERIES.slice(0, paying.wilds ?? 0);
      const board = withInPlay(game(), ...batteries);
      const given = giveCards(board.state, p1, card, ...(paying.cards ?? []));
      const [played, ...hand] = given.ids as [InstanceId, ...InstanceId[]];
      const payment: readonly Payment[] = [
        ...batteries.map((_, index) => ({
          ability: { instanceId: board.ids[index] as InstanceId, abilityId: BATTERY_RESOURCE.ref.id },
        })),
        ...fromHand(...hand),
      ];
      const result = applyCommand(given.state, playCard(played, payment, paying.wildAs), deps);
      if (result.ok) throw new Error("the command was accepted");
      expect(result.error.code).toBe("invalid_choice");
      return result.error.message;
    }

    it("too few entries", () => {
      expect(refused(FIRECRACKER.id, { wilds: 2, wildAs: ["energy"] })).toMatch(/2 generated, 1 declared/);
    });

    it("too many entries", () => {
      expect(refused(FIRECRACKER.id, { wilds: 1, cards: [STRENGTH.id], wildAs: ["energy", "mental"] })).toMatch(
        /1 generated, 2 declared/,
      );
    });

    it("a declaration for a payment with no wild", () => {
      expect(refused(FIRECRACKER.id, { cards: [ENERGY.id, MENTAL.id], wildAs: ["energy"] })).toMatch(
        /0 generated, 1 declared/,
      );
    });

    it("not a resource type", () => {
      expect(refused(FIRECRACKER.id, { wilds: 2, wildAs: ["energy", "cosmic" as ResourceType] })).toMatch(
        /not a resource type/,
      );
    });

    it("a wild the cost needs as [physical] declared [energy]", () => {
      expect(refused(TYPED_ZERO.id, { wilds: 1, wildAs: ["energy"] })).toMatch(/needs 1 physical/);
    });

    it("the wrong number on a payment nothing reads", () => {
      expect(refused(UNLIKELY_DUO.id, { wilds: 2, wildAs: ["energy"] })).toMatch(/2 generated, 1 declared/);
    });
  });
});

describe("§3.62 an illegal answer to the choice is refused", () => {
  function asking(card: CardId, wilds: number) {
    const batteries = BATTERIES.slice(0, wilds);
    const board = withInPlay(game(), ...batteries);
    const given = giveCard(board.state, p1, card);
    const payment = board.ids.map((instanceId) => ({ ability: { instanceId, abilityId: BATTERY_RESOURCE.ref.id } }));
    const result = applyCommand(given.state, playCard(given.id, payment), deps);
    if (!result.ok) throw new Error(result.error.message);
    const choice = result.state.pendingChoice;
    if (choice?.prompt.kind !== "declareWildTypes") throw new Error("not asked");
    const answer = (selectedOptionIds: readonly string[]) =>
      applyCommand(
        result.state,
        { type: "resolveChoice", playerId: p1, choiceId: choice.choiceId, selectedOptionIds },
        deps,
      );
    return { answer, before: villainDamage(given.state) };
  }

  it("two types for one wild and none for the other", () => {
    const { answer } = asking(FIRECRACKER.id, 2);
    const result = answer(["0:energy", "0:mental"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/one type for each wild/);
  });

  it("too few selections", () => {
    const { answer } = asking(FIRECRACKER.id, 2);
    expect(answer(["0:energy"]).ok).toBe(false);
  });

  it("an option that is not offered", () => {
    const { answer } = asking(FIRECRACKER.id, 2);
    expect(answer(["0:energy", "1:cosmic"]).ok).toBe(false);
  });

  it("a declaration under which the cost is no longer paid; a legal one then resolves the card", () => {
    // Cost 1 and "spend a [physical] resource", paid with two wilds: one of them is the [physical].
    const { answer, before } = asking(TYPED_ONE.id, 2);
    const illegal = answer(["0:energy", "1:mental"]);
    expect(illegal.ok).toBe(false);
    if (!illegal.ok) expect(illegal.error.message).toMatch(/needs 1 physical/);
    const two = answer(["0:energy", "1:physical"]);
    if (!two.ok) throw new Error(two.error.message);
    expect(villainDamage(two.state) - before).toBe(2000);
    const one = answer(["0:physical", "1:physical"]);
    if (!one.ok) throw new Error(one.error.message);
    expect(villainDamage(one.state) - before).toBe(1000);
  });
});

describe("§3.62 a card played inside a timing window", () => {
  it("a response event paid with a wild and [physical] is asked after its payment, before it resolves", () => {
    const board = withInPlay(game(), BATTERY.id);
    const given = giveCards(board.state, p1, UNLIKELY_DUO.id, ECHO.id, STRENGTH.id, ENERGY.id, ENERGY.id);
    // The response event (Echo) stays in hand until its window offers it.
    const [duo, , strength, ...energies] = given.ids as [InstanceId, InstanceId, InstanceId, ...InstanceId[]];
    const batteryOption = `ability:${board.ids[0]}:${BATTERY_RESOURCE.ref.id}`;
    const kinds: string[] = [];
    const other = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (!choice) return [];
      kinds.push(choice.prompt.kind);
      if (choice.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
      if (choice.prompt.kind === "payForCard") return [batteryOption, `hand:${strength}`];
      return defaultPick(state);
    };
    const before = villainDamage(given.state);
    const play = [playCard(duo, fromHand(...energies))];
    const two = drive(given.state, play, [["mental"]], other);
    expect(two.asked).toBe(1);
    expect(kinds).toEqual(["chooseTriggers", "payForCard"]);
    // Unlikely Duo's 1, the response's 7, and its 700 for two types.
    expect(villainDamage(two.state) - before).toBe(708);
    const one = drive(given.state, play, [["physical"]], other);
    expect(villainDamage(one.state) - before).toBe(8);
  });
});

describe("§3.62 cards that do not read types are untouched", () => {
  it("a Core Set ally paid for with wilds: no prompt, no declaration, the log as it always was", () => {
    const run = playPaying(MOCKINGBIRD.id, { wilds: 2, cards: [POWER.id] });
    expect(run.asked).toBe(0);
    expect(ofType(run.events, "choiceRequested")).toEqual([]);
    expect(ofType(run.events, "wildTypesDeclared")).toEqual([]);
    const played = ofType(run.events, "cardPlayed")[0];
    expect(played).toEqual({
      type: "cardPlayed",
      playerId: p1,
      instanceId: expect.any(String),
      cardId: MOCKINGBIRD.id,
      resourcesPaid: 3,
      paid: { physical: 0, mental: 0, energy: 0, wild: 3 },
    });
    expect(run.state.players[0]?.playArea.map((id) => mustInstance(run.state, id).cardId)).toContain(MOCKINGBIRD.id);
  });

  it("legalActions lists the same commands whether or not a card in hand reads types", () => {
    const board = withInPlay(game(), BATTERY.id);
    const given = giveCards(board.state, p1, FIRECRACKER.id, UNLIKELY_DUO.id, STRENGTH.id);
    const unmarked: EngineDeps = depsOf(...ABILITIES.map((a) => (a === FIRE ? FIRE_UNMARKED : a)));
    expect(unmarked.abilities[FIRE.ref.id]?.readsPaidTypes).toBeUndefined();
    const marked = legalActions(given.state, p1, deps);
    expect(marked).toEqual(legalActions(given.state, p1, unmarked));
    expect(JSON.stringify(marked)).not.toContain("wildAs");
    // And with a reader in play beside one without.
    const withReader = withInPlay(given.state, SUNGLASSES.id).state;
    expect(JSON.stringify(legalActions(withReader, p1, deps))).not.toContain("wildAs");
  });

  it("the unmarked text reads nothing, and its payment asks nothing", () => {
    const board = withInPlay(game(), BATTERY.id);
    const given = giveCards(board.state, p1, FIRECRACKER.id, STRENGTH.id);
    const [fire, strength] = given.ids as [InstanceId, InstanceId];
    const battery = { ability: { instanceId: board.ids[0] as InstanceId, abilityId: BATTERY_RESOURCE.ref.id } };
    const unmarked: EngineDeps = depsOf(...ABILITIES.map((a) => (a === FIRE ? FIRE_UNMARKED : a)));
    const before = villainDamage(given.state);
    const run = drive(given.state, [playCard(fire, [battery, ...fromHand(strength)])], [], defaultPick, unmarked);
    expect(run.asked).toBe(0);
    expect(villainDamage(run.state) - before).toBe(4);
  });
});

describe("§3.62 replay", () => {
  it("declarations made by choice and on the command replay deep-equal, and the log holds them", () => {
    const board = withInPlay(game(), ...BATTERIES, SUNGLASSES.id);
    const given = giveCards(
      board.state,
      p1,
      FIRECRACKER.id,
      STRENGTH.id,
      MULTITALENTED.id,
      STRENGTH.id,
      PHYSICAL_EVENT.id,
    );
    const [fire, strength, multi, second, third] = given.ids as [
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
    ];
    const battery = (index: number): Payment => ({
      ability: { instanceId: board.ids[index] as InstanceId, abilityId: BATTERY_RESOURCE.ref.id },
    });
    const before = villainDamage(given.state);
    const first = drive(given.state, [playCard(fire, [battery(0), ...fromHand(strength)])], [["mental"]]);
    // Firecracker's 104, and the Sunglasses' 2000 for its two types.
    expect(villainDamage(first.state) - before).toBe(2104);
    // The second wild, declared on the command: Multitalented's [physical] and [energy] lines, and 2000 more.
    const run = driveSession(
      first.session,
      deps,
      [playCard(multi, [battery(1), ...fromHand(second, third)], ["energy"])],
      defaultPick,
    );
    expect(villainDamage(run.session.state) - before).toBe(2104 + 101 + 2000);

    const commands = run.session.log.commands;
    const declaredByChoice = commands.filter(
      (c) => c.type === "resolveChoice" && c.selectedOptionIds[0] === "0:mental",
    );
    expect(declaredByChoice).toHaveLength(1);
    expect(commands.filter((c) => c.type === "playCard" && c.wildAs !== undefined)).toEqual([
      expect.objectContaining({ cardInstanceId: multi, wildAs: ["energy"] }),
    ]);

    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.session.state);
    expect(ofType(replayed.events, "wildTypesDeclared").map((e) => [e.declared, e.skipped])).toEqual([
      [["mental"], false],
      [["energy"], false],
    ]);
  });
});
