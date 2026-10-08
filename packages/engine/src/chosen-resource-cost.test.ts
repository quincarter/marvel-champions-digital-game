/**
 * docs/phase7-wave8.md §3.62, half (b): a resource cost of a chosen size, `AbilityCost.resources { choose: { min, max } }`
 * ("spend up to 3 resources →", Husk `jubilee` 47012), and the types an ability reads of its own spent pool
 * (`Predicate paidType`, `ValueSpec paidTypeCount`). Proven with synthetic cards driving real `useAbility` commands,
 * and a basic thwart whose optional Interrupt is paid for inside its window.
 *
 * Sources: RRG 1.8 "Cost" (p. 13: a cost is paid in full or not at all; resources paid for an ability on a card are
 * paid for that card; p. 14: "A cost requiring 'any number' or 'up to' some number of game elements requires a minimum
 * of one such game element"), "Wild Resource" (p. 48: "When a player generates a wild resource, they may specify which
 * resource type (energy, mental, physical, or wild) it is being used as"), "Resource" (p. 37: four types). Owner
 * decision §4.1 Q33 = B: the player declares each wild; the engine never picks, and skips the question only when every
 * declaration reads the same.
 *
 * **No overpayment.** The spec's reading (§3.62 "Husk"): the player sizes this cost, so everything generated was spent.
 * A payment that generates more than `max` is refused rather than capped, and §4.1 Q34's "the paid resources that give
 * the most declared types", with task 8's tie order (physical, mental, energy, wild), has nothing to select here: the
 * paid resources are the whole pool.
 *
 * Husk's printed text, as on her scan (`assets/card-art/bundles/cards/47012.jpg`): "Interrupt: When Husk uses a basic
 * power, spend up to 3 resources → if you spent at least 1: [energy] - Husk gets +1 to that power for this use.
 * [mental] - Heal 1 damage from Husk. [physical] - Ready Husk after this use."
 *
 * Every probe writes what it read as damage on the villain, so one number names the reading:
 * 1 for a [physical] line, 10 for [mental], 100 for [energy]; 1,000 for each resource of the chosen size
 * (`cost.resources`); 10,000 for each resource paid (`paid.count`); 1,000,000 for each resource overpaid (never).
 */

import { flat, type AbilityId, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command, CostSelection, Payment } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { legalActions, paymentFor, tryPayment } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import { EMPTY_POOL, wildTypeOptionId, type ResourceType, type TypedResource } from "./resources.js";
import { createGame } from "./setup.js";
import type { EffectSpec, Predicate, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession, runCommands } from "./testing/drive.js";
import { stubAlly, stubMainScheme, stubResource, stubSupport, stubTreachery, stubVillain } from "./testing/fixtures.js";
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
const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const QUIET_VILLAIN = stubVillain({ id: "quiet", stages: [{ hp: flat(90000000), atk: 0, sch: 0 }] });
const LONG_SCHEME = stubMainScheme({
  id: "long",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

const constant = (value: number): ValueSpec => ({ kind: "const", value });
const varOf = (name: string): ValueSpec => ({ kind: "var", name });
const times = (value: ValueSpec, n: number): ValueSpec => ({ kind: "scaled", value, times: n });
const damage = (amount: number | ValueSpec): EffectSpec => ({
  kind: "dealDamage",
  target: { kind: "villain" },
  amount: typeof amount === "number" ? constant(amount) : amount,
});
const ifThen = (condition: Predicate, then: readonly EffectSpec[]): EffectSpec => ({ kind: "if", condition, then });
const paidType = (resource: TypedResource): Predicate => ({ kind: "paidType", resource });
/** "If you spent at least 1: [physical] 1, [mental] 10, [energy] 100." */
const LINES: readonly EffectSpec[] = [
  ifThen(paidType("physical"), [damage(1)]),
  ifThen(paidType("mental"), [damage(10)]),
  ifThen(paidType("energy"), [damage(100)]),
];
/** The size chosen, the resources paid and the resources overpaid, each in its own column of the villain's damage. */
const SIZES: readonly EffectSpec[] = [
  damage(times(varOf("cost.resources"), 1000)),
  damage(times(varOf("paid.count"), 10000)),
  damage(times(varOf("overpaid.total"), 1000000)),
];

/** "Action: Spend up to 3 resources → if you spent at least 1: [energy] … [mental] … [physical] …" */
const SPEND = stubAbility("spend.action", {
  trigger: { kind: "action" },
  cost: { resources: { choose: { min: 1, max: 3 } } },
  readsPaidTypes: { types: ["energy", "mental", "physical"] },
  effects: [...LINES, ...SIZES],
});
const SPENDER = stubSupport({ id: "spender", cost: 0, abilities: [SPEND.ref] });
/** The same cost reading two lines only: [energy] 100, [mental] 10. */
const SPEND_EM = stubAbility("spend-em.action", {
  trigger: { kind: "action" },
  cost: { resources: { choose: { min: 1, max: 3 } } },
  readsPaidTypes: { types: ["energy", "mental"] },
  effects: [ifThen(paidType("mental"), [damage(10)]), ifThen(paidType("energy"), [damage(100)]), ...SIZES],
});
const SPENDER_EM = stubSupport({ id: "spender-em", cost: 0, abilities: [SPEND_EM.ref] });
/** "Spend up to 3 resources → 7 for each different resource type spent": a count reader. */
const COUNT = stubAbility("count.action", {
  trigger: { kind: "action" },
  cost: { resources: { choose: { min: 1, max: 3 } } },
  readsPaidTypes: { count: true },
  effects: [damage(times({ kind: "paidTypeCount" }, 7)), ...SIZES],
});
const COUNTER = stubSupport({ id: "counter", cost: 0, abilities: [COUNT.ref] });
/** "Spend 2 or 3 resources →": a minimum above one. */
const AT_LEAST_TWO = stubAbility("two.action", {
  trigger: { kind: "action" },
  cost: { resources: { choose: { min: 2, max: 3 } } },
  effects: SIZES,
});
const TWO_OR_THREE = stubSupport({ id: "two-or-three", cost: 0, abilities: [AT_LEAST_TWO.ref] });
/** "Spend exactly 1 resource of your choosing →": a card with two icons cannot pay it. */
const EXACTLY_ONE = stubAbility("one.action", {
  trigger: { kind: "action" },
  cost: { resources: { choose: { min: 1, max: 1 } } },
  effects: SIZES,
});
const ONE_ONLY = stubSupport({ id: "one-only", cost: 0, abilities: [EXACTLY_ONE.ref] });
/** The same lines with no mark: an ability that reads no types records none. */
const UNMARKED = stubAbility("unmarked.action", {
  trigger: { kind: "action" },
  cost: { resources: { choose: { min: 1, max: 3 } } },
  effects: [...LINES, ...SIZES],
});
const UNMARKED_CARD = stubSupport({ id: "unmarked-card", cost: 0, abilities: [UNMARKED.ref] });
/** An ordinary fixed cost: "Spend 2 resources → deal 5 damage." */
const FIXED = stubAbility("fixed.action", {
  trigger: { kind: "action" },
  cost: { resources: 2 },
  effects: [damage(5), ...SIZES.slice(1)],
});
const FIXED_CARD = stubSupport({ id: "fixed-card", cost: 0, abilities: [FIXED.ref] });

/** "Resource: exhaust this card → generate a [wild] resource" / "… an [energy] resource", on cards in play. */
const BATTERY_RESOURCE = stubAbility("battery.resource", {
  trigger: { kind: "resource" },
  cost: { exhaustSelf: true },
  generates: { wild: 1 },
  effects: [],
});
const BATTERY = stubSupport({ id: "battery", cost: 0, abilities: [BATTERY_RESOURCE.ref] });
const DYNAMO_RESOURCE = stubAbility("dynamo.resource", {
  trigger: { kind: "resource" },
  cost: { exhaustSelf: true },
  generates: { energy: 1 },
  effects: [],
});
const DYNAMO = stubSupport({ id: "dynamo", cost: 0, abilities: [DYNAMO_RESOURCE.ref] });

/**
 * Husk as printed, with THW 2, 3 hit points and one consequential damage for a thwart: [energy] +1 to the power for
 * this use, [mental] heal 1 from her, [physical] a `physical` counter on her (her "ready after this use" is the
 * scripting's; here it only has to be read).
 */
const HUSK_INTERRUPT = stubAbility("husk.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "basicPowerUsing", targetIs: { self: true } } },
  cost: { resources: { choose: { min: 1, max: 3 } } },
  readsPaidTypes: { types: ["energy", "mental", "physical"] },
  effects: [
    ifThen(paidType("energy"), [{ kind: "modifyBasicPower", amount: constant(1) }]),
    ifThen(paidType("mental"), [{ kind: "heal", target: { kind: "self" }, amount: constant(1) }]),
    ifThen(paidType("physical"), [
      { kind: "addCounters", target: { kind: "self" }, counterType: "physical", amount: constant(1) },
    ]),
  ],
});
const HUSK = stubAlly({
  id: "husk",
  cost: 0,
  atk: 2,
  thw: 2,
  hp: 3,
  consequentialThwart: 1,
  abilities: [HUSK_INTERRUPT.ref],
});

/** Energy, Genius, Strength; Plasmoid Energy 47010a ([energy][mental]); Genius doubled; a card with one [wild]. */
const ENERGY = stubResource({ id: "energy-card", icons: 1, produces: { energy: 1 } });
const MENTAL = stubResource({ id: "mental-card", icons: 1, produces: { mental: 1 } });
const STRENGTH = stubResource({ id: "strength-card", icons: 1, produces: { physical: 1 } });
const PLASMOID = stubResource({ id: "plasmoid", icons: 2, produces: { energy: 1, mental: 1 } });
const GENIUS = stubResource({ id: "genius", icons: 2, produces: { mental: 2 } });
const WILD = stubResource({ id: "wild-card", icons: 1 });

const ABILITIES = [
  SPEND,
  SPEND_EM,
  COUNT,
  AT_LEAST_TWO,
  EXACTLY_ONE,
  UNMARKED,
  FIXED,
  BATTERY_RESOURCE,
  DYNAMO_RESOURCE,
  HUSK_INTERRUPT,
];
const deps: EngineDeps = depsOf(...ABILITIES);
const PLAYER_CARDS = [
  SPENDER,
  SPENDER_EM,
  COUNTER,
  TWO_OR_THREE,
  ONE_ONLY,
  UNMARKED_CARD,
  FIXED_CARD,
  BATTERY,
  DYNAMO,
  HUSK,
  ENERGY,
  MENTAL,
  STRENGTH,
  PLASMOID,
  GENIUS,
  WILD,
];
const PLAYER_DECK = [
  ...PLAYER_CARDS.map((c) => c.id),
  ...copies(ENERGY.id, 3),
  ...copies(STRENGTH.id, 2),
  MENTAL.id,
  WILD.id,
  GENIUS.id,
];

function game(): GameState {
  const identities = seatIdentities(HERO, 1);
  const result = createGame(
    {
      seed: 9,
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
const villainDamage = (state: GameState): number =>
  mustInstance(state, state.villains[0]?.instanceId as InstanceId).damage;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const declarationIds = (types: readonly ResourceType[]): readonly string[] =>
  types.map((type, index) => wildTypeOptionId(index, type));
const pool = (parts: Partial<Record<ResourceType, number>>) => ({ ...EMPTY_POOL, ...parts });

interface Driven {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  /** How many `declareWildTypes` choices were asked. */
  readonly asked: number;
}

/**
 * Applies `commands` through a session, answering each `declareWildTypes` choice with the next of `declarations` and
 * every other choice with `other`; the log is then replayed and must give the same state.
 */
function drive(
  start: GameState,
  commands: readonly Command[],
  declarations: readonly (readonly ResourceType[])[] = [],
  other: (state: GameState) => readonly string[] = defaultPick,
): Driven {
  let asked = 0;
  const pick = (state: GameState): readonly string[] => {
    if (state.pendingChoice?.prompt.kind !== "declareWildTypes") return other(state);
    const declared = declarations[asked];
    asked += 1;
    return declared ? declarationIds(declared) : defaultPick(state);
  };
  const { session, events } = driveSession(startSession(start), deps, commands, pick);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events, asked };
}

/** Puts each of `cards` (cost 0) into play, in order. */
function withInPlay(start: GameState, ...cards: readonly CardId[]): { state: GameState; ids: readonly InstanceId[] } {
  let state = start;
  const ids: InstanceId[] = [];
  for (const card of cards) {
    const given = giveCard(state, p1, card, ids);
    state = runCommands(given.state, deps, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    }).state;
    ids.push(given.id);
  }
  return { state, ids };
}

/** Everything else in hand goes to the discard pile (test surgery), so only `keep` can pay. */
function handOnly(state: GameState, keep: readonly InstanceId[]): GameState {
  const seat = mustPlayer(state, p1);
  const dropped = seat.hand.filter((id) => !keep.includes(id));
  return {
    ...state,
    players: state.players.map((p) =>
      p.playerId === p1
        ? { ...p, hand: p.hand.filter((id) => keep.includes(id)), discard: [...dropped, ...p.discard] }
        : p,
    ),
  };
}

interface Board {
  readonly state: GameState;
  /** The card carrying the ability. */
  readonly source: InstanceId;
  /** The cards handed over to pay, in the order asked for. */
  readonly hand: readonly InstanceId[];
  /** The other cards put into play (resource generators), in the order asked for. */
  readonly inPlay: readonly InstanceId[];
}

/** A fresh game with `card` in play, `inPlay` beside it, and `cards` in hand. */
function board(card: CardId, cards: readonly CardId[] = [], inPlay: readonly CardId[] = []): Board {
  const placed = withInPlay(game(), card, ...inPlay);
  const given = giveCards(placed.state, p1, ...cards);
  const [source, ...rest] = placed.ids as [InstanceId, ...InstanceId[]];
  return { state: given.state, source, hand: given.ids, inPlay: rest };
}

const use = (
  at: Board,
  ability: StubAbility,
  payment: readonly Payment[],
  extra: { readonly wildAs?: readonly ResourceType[]; readonly costSelection?: CostSelection } = {},
): Command & { type: "useAbility" } => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: at.source,
  abilityId: ability.ref.id,
  payment,
  ...extra,
});
const abilityOf = (at: Board, index: number, abilityId: AbilityId): Payment => ({
  ability: { instanceId: at.inPlay[index] as InstanceId, abilityId },
});

/** Uses SPEND-shaped `ability` paying with the whole hand handed over; the villain's damage before it subtracted. */
function spend(
  card: CardId,
  ability: StubAbility,
  cards: readonly CardId[],
  options: {
    readonly declare?: readonly (readonly ResourceType[])[];
    readonly wildAs?: readonly ResourceType[];
    readonly costSelection?: CostSelection;
  } = {},
): Driven & { readonly dealt: number; readonly board: Board } {
  const at = board(card, cards);
  const before = villainDamage(at.state);
  const run = drive(
    at.state,
    [
      use(at, ability, fromHand(...at.hand), {
        ...(options.wildAs ? { wildAs: options.wildAs } : {}),
        ...(options.costSelection ? { costSelection: options.costSelection } : {}),
      }),
    ],
    options.declare,
  );
  for (const id of at.hand) expect(mustPlayer(run.state, p1).hand).not.toContain(id);
  return { ...run, dealt: villainDamage(run.state) - before, board: at };
}

/** The engine's refusal of a command, with nothing changed. */
function refused(state: GameState, command: Command): { readonly code: string; readonly message: string } {
  const result = applyCommand(state, command, deps);
  if (result.ok) throw new Error("the command was accepted");
  return { code: result.error.code, message: result.error.message };
}

describe("§3.62 (b) a resource cost of a chosen size: the size is what the payment generates", () => {
  it("at the minimum: one [energy] card is a size of 1, one resource paid, nothing overpaid", () => {
    const run = spend(SPENDER.id, SPEND, [ENERGY.id]);
    expect(run.dealt).toBe(100 + 1000 + 10000);
    expect(run.asked).toBe(0);
  });

  it("between: [energy] and [physical] cards are a size of 2", () => {
    expect(spend(SPENDER.id, SPEND, [ENERGY.id, STRENGTH.id]).dealt).toBe(101 + 2000 + 20000);
  });

  it("at the maximum: one card of each type is a size of 3 and reads all three lines", () => {
    expect(spend(SPENDER.id, SPEND, [ENERGY.id, MENTAL.id, STRENGTH.id]).dealt).toBe(111 + 3000 + 30000);
  });

  it("each line at most once however many resources of its type were spent: three [energy] read 100", () => {
    expect(spend(SPENDER.id, SPEND, [ENERGY.id, ENERGY.id, ENERGY.id]).dealt).toBe(100 + 3000 + 30000);
  });

  it("a card with two icons is two spent resources of its type: Genius alone is a size of 2", () => {
    expect(spend(SPENDER.id, SPEND, [GENIUS.id]).dealt).toBe(10 + 2000 + 20000);
    // Plasmoid Energy ([energy][mental]) is two resources of two types.
    expect(spend(SPENDER.id, SPEND, [PLASMOID.id]).dealt).toBe(110 + 2000 + 20000);
    // Genius and an [energy] card: three.
    expect(spend(SPENDER.id, SPEND, [GENIUS.id, ENERGY.id]).dealt).toBe(110 + 3000 + 30000);
  });

  it("a resource generated by a card in play is spent like any other", () => {
    const at = board(SPENDER.id, [STRENGTH.id], [DYNAMO.id]);
    const before = villainDamage(at.state);
    const alone = drive(at.state, [use(at, SPEND, [abilityOf(at, 0, DYNAMO_RESOURCE.ref.id)])]);
    expect(villainDamage(alone.state) - before).toBe(100 + 1000 + 10000);
    expect(mustInstance(alone.state, at.inPlay[0] as InstanceId).exhausted).toBe(true);
    const withCard = drive(at.state, [
      use(at, SPEND, [abilityOf(at, 0, DYNAMO_RESOURCE.ref.id), ...fromHand(...at.hand)]),
    ]);
    expect(villainDamage(withCard.state) - before).toBe(101 + 2000 + 20000);
  });

  it("the size may be named beside the payment (`costSelection.resources`), and must agree with it", () => {
    expect(spend(SPENDER.id, SPEND, [ENERGY.id, STRENGTH.id], { costSelection: { resources: 2 } }).dealt).toBe(22101);
    const at = board(SPENDER.id, [ENERGY.id, MENTAL.id, STRENGTH.id]);
    // Chose 2, offered three cards: one would be overpaid.
    const more = refused(at.state, use(at, SPEND, fromHand(...at.hand), { costSelection: { resources: 2 } }));
    expect(more.code).toBe("invalid_choice");
    expect(more.message).toMatch(/chose to spend 2 resources; the payment is 3/);
    // Chose 3, offered two.
    expect(
      refused(at.state, use(at, SPEND, fromHand(...at.hand.slice(0, 2)), { costSelection: { resources: 3 } })).code,
    ).toBe("invalid_choice");
    // A size outside the range, whatever is offered.
    for (const resources of [0, 4, 1.5]) {
      expect(refused(at.state, use(at, SPEND, fromHand(...at.hand), { costSelection: { resources } })).code).toBe(
        "invalid_choice",
      );
    }
    expect(mustPlayer(at.state, p1).hand).toEqual(expect.arrayContaining([...at.hand]));
  });
});

describe("§3.62 (b) outside the range the payment is refused and nothing is spent", () => {
  it("below the minimum: spending nothing is not a payment (RRG p. 14)", () => {
    const at = board(SPENDER.id, [ENERGY.id]);
    const none = refused(at.state, use(at, SPEND, []));
    expect(none.code).toBe("insufficient_resources");
    expect(none.message).toMatch(/spend at least 1 resource; the payment is 0/);
  });

  it("below a minimum of 2: one resource is refused, two and three are taken", () => {
    const at = board(TWO_OR_THREE.id, [ENERGY.id, MENTAL.id, STRENGTH.id]);
    expect(refused(at.state, use(at, AT_LEAST_TWO, fromHand(at.hand[0] as InstanceId))).code).toBe(
      "insufficient_resources",
    );
    const before = villainDamage(at.state);
    const two = drive(at.state, [use(at, AT_LEAST_TWO, fromHand(...at.hand.slice(0, 2)))]);
    expect(villainDamage(two.state) - before).toBe(2000 + 20000);
    const three = drive(at.state, [use(at, AT_LEAST_TWO, fromHand(...at.hand))]);
    expect(villainDamage(three.state) - before).toBe(3000 + 30000);
  });

  it('above the maximum: four cards toward "up to 3" are refused, not capped (no overpayment)', () => {
    const at = board(SPENDER.id, [ENERGY.id, MENTAL.id, STRENGTH.id, WILD.id]);
    const over = refused(at.state, use(at, SPEND, fromHand(...at.hand)));
    expect(over.code).toBe("invalid_choice");
    expect(over.message).toMatch(/spend at most 3 resources; the payment is 4, and this cost cannot be overpaid/);
    for (const id of at.hand) expect(mustPlayer(at.state, p1).hand).toContain(id);
  });

  it("above the maximum by a second icon: Genius and Plasmoid Energy are four resources", () => {
    const at = board(SPENDER.id, [GENIUS.id, PLASMOID.id]);
    expect(refused(at.state, use(at, SPEND, fromHand(...at.hand))).code).toBe("invalid_choice");
    // Either one alone is a size of 2.
    const before = villainDamage(at.state);
    const one = drive(at.state, [use(at, SPEND, fromHand(at.hand[1] as InstanceId))]);
    expect(villainDamage(one.state) - before).toBe(110 + 2000 + 20000);
    expect(mustPlayer(one.state, p1).hand).toContain(at.hand[0]);
  });

  it("a size of exactly 1 cannot be paid with a card of two icons", () => {
    const at = board(ONE_ONLY.id, [GENIUS.id, ENERGY.id]);
    expect(refused(at.state, use(at, EXACTLY_ONE, fromHand(at.hand[0] as InstanceId))).code).toBe("invalid_choice");
    const before = villainDamage(at.state);
    const one = drive(at.state, [use(at, EXACTLY_ONE, fromHand(at.hand[1] as InstanceId))]);
    expect(villainDamage(one.state) - before).toBe(1000 + 10000);
  });
});

describe("§3.62 (b) (Q33 = B) the wilds of an ability's spent pool are the player's to declare", () => {
  it("one wild spent alone on an ability that reads named types: asked, and each answer is its own line", () => {
    const by = (type: ResourceType) => spend(SPENDER.id, SPEND, [WILD.id], { declare: [[type]] });
    const energy = by("energy");
    expect(energy.asked).toBe(1);
    expect(energy.dealt).toBe(100 + 1000 + 10000);
    expect(by("mental").dealt).toBe(10 + 1000 + 10000);
    expect(by("physical").dealt).toBe(1 + 1000 + 10000);
    // Left a wild it is none of the three.
    const left = by("wild");
    expect(left.asked).toBe(1);
    expect(left.dealt).toBe(1000 + 10000);
  });

  it("the prompt names the ability, offers four types for the wild and preselects none; the answer is logged", () => {
    const at = board(SPENDER.id, [WILD.id, STRENGTH.id]);
    const paid = applyCommand(at.state, use(at, SPEND, fromHand(...at.hand)), deps);
    if (!paid.ok) throw new Error(paid.error.message);
    const choice = paid.state.pendingChoice;
    expect(choice?.playerId).toBe(p1);
    expect(choice?.prompt).toEqual({
      kind: "declareWildTypes",
      instanceId: at.source,
      abilityId: SPEND.ref.id,
      wilds: 1,
      pool: pool({ physical: 1, wild: 1 }),
      // What the cost took: the whole pool, since the player sized it.
      requirement: { generic: 2, physical: 0, mental: 0, energy: 0 },
    });
    expect(choice?.options.map((o) => o.optionId)).toEqual(["0:energy", "0:mental", "0:physical", "0:wild"]);
    expect([choice?.minSelections, choice?.maxSelections]).toEqual([1, 1]);
    // The cards are spent already and nothing of the ability has resolved.
    for (const id of at.hand) expect(mustPlayer(paid.state, p1).hand).not.toContain(id);
    expect(villainDamage(paid.state)).toBe(villainDamage(at.state));
    expect(ofType(paid.events, "abilityResolved")).toHaveLength(0);

    const run = drive(at.state, [use(at, SPEND, fromHand(...at.hand))], [["energy"]]);
    expect(villainDamage(run.state) - villainDamage(at.state)).toBe(101 + 2000 + 20000);
    expect(ofType(run.events, "wildTypesDeclared")).toEqual([
      {
        type: "wildTypesDeclared",
        playerId: p1,
        instanceId: at.source,
        abilityId: SPEND.ref.id,
        declared: ["energy"],
        skipped: false,
        paidAs: pool({ physical: 1, energy: 1 }),
      },
    ]);
  });

  it("the engine does not improve on the answer: a wild declared [physical] beside a [physical] card is one line", () => {
    expect(spend(SPENDER.id, SPEND, [WILD.id, STRENGTH.id], { declare: [["physical"]] }).dealt).toBe(1 + 22000);
  });

  it("two wilds, one from a card in play: two declarations, read as declared", () => {
    const at = board(COUNTER.id, [WILD.id], [BATTERY.id]);
    const payment = [abilityOf(at, 0, BATTERY_RESOURCE.ref.id), ...fromHand(...at.hand)];
    const before = villainDamage(at.state);
    const by = (types: readonly ResourceType[]) => {
      const run = drive(at.state, [use(at, COUNT, payment)], [types]);
      expect(run.asked).toBe(1);
      return villainDamage(run.state) - before;
    };
    expect(by(["energy", "mental"])).toBe(2 * 7 + 22000);
    expect(by(["energy", "wild"])).toBe(2 * 7 + 22000);
    expect(by(["energy", "energy"])).toBe(7 + 22000);
    expect(by(["wild", "wild"])).toBe(7 + 22000);
  });

  it("no wild spent: nothing is asked and nothing is declared", () => {
    const run = spend(SPENDER.id, SPEND, [PLASMOID.id, STRENGTH.id]);
    expect(run.asked).toBe(0);
    expect(run.dealt).toBe(111 + 3000 + 30000);
    expect(ofType(run.events, "wildTypesDeclared")).toHaveLength(0);
  });

  describe("the one shortcut: every declaration reads the same, so nothing is asked", () => {
    it("one wild alone on an ability that only counts types: one type whatever it is called", () => {
      const run = spend(COUNTER.id, COUNT, [WILD.id]);
      expect(run.asked).toBe(0);
      expect(run.dealt).toBe(7 + 1000 + 10000);
      expect(ofType(run.events, "wildTypesDeclared")).toEqual([
        expect.objectContaining({
          abilityId: COUNT.ref.id,
          declared: ["wild"],
          skipped: true,
          paidAs: pool({ wild: 1 }),
        }),
      ]);
    });

    it("the typed resources already fill every line the ability reads: [energy][mental] and a wild", () => {
      const run = spend(SPENDER_EM.id, SPEND_EM, [PLASMOID.id, WILD.id]);
      expect(run.asked).toBe(0);
      expect(run.dealt).toBe(110 + 3000 + 30000);
      expect(ofType(run.events, "wildTypesDeclared")).toEqual([
        expect.objectContaining({ declared: ["wild"], skipped: true }),
      ]);
    });

    it("the near-identical case where it does not apply: the same wild beside an [energy] card alone is asked", () => {
      const run = spend(SPENDER_EM.id, SPEND_EM, [ENERGY.id, WILD.id], { declare: [["mental"]] });
      expect(run.asked).toBe(1);
      expect(run.dealt).toBe(110 + 2000 + 20000);
    });

    it("an ability that reads no types asks nothing and records nothing, wild or not", () => {
      const run = spend(UNMARKED_CARD.id, UNMARKED, [WILD.id, STRENGTH.id]);
      expect(run.asked).toBe(0);
      // No `paid.as.*` was recorded, so no line reads.
      expect(run.dealt).toBe(2000 + 20000);
      expect(ofType(run.events, "wildTypesDeclared")).toHaveLength(0);
    });
  });

  describe("the declaration on the command (`useAbility.wildAs`)", () => {
    it("given up front: no prompt, and it is the player's own declaration in the log", () => {
      const run = spend(SPENDER.id, SPEND, [WILD.id], { wildAs: ["mental"] });
      expect(run.asked).toBe(0);
      expect(run.dealt).toBe(10 + 1000 + 10000);
      expect(ofType(run.events, "wildTypesDeclared")).toEqual([
        expect.objectContaining({ abilityId: SPEND.ref.id, declared: ["mental"], skipped: false }),
      ]);
    });

    it("given where the engine would have skipped the question: it stands as given", () => {
      const run = spend(COUNTER.id, COUNT, [WILD.id], { wildAs: ["energy"] });
      expect(run.dealt).toBe(7 + 1000 + 10000);
      expect(ofType(run.events, "wildTypesDeclared")).toEqual([
        expect.objectContaining({ declared: ["energy"], skipped: false, paidAs: pool({ energy: 1 }) }),
      ]);
    });

    it("the wrong number of entries, or a type that is none of the four, is refused and nothing is spent", () => {
      const at = board(SPENDER.id, [WILD.id, STRENGTH.id]);
      const payment = fromHand(...at.hand);
      expect(refused(at.state, use(at, SPEND, payment, { wildAs: [] })).message).toMatch(/1 generated, 0 declared/);
      expect(refused(at.state, use(at, SPEND, payment, { wildAs: ["energy", "mental"] })).code).toBe("invalid_choice");
      expect(refused(at.state, use(at, SPEND, payment, { wildAs: ["bogus" as ResourceType] })).message).toMatch(
        /not a resource type/,
      );
    });

    it("legal on an ability nothing reads: accepted, and nothing is recorded", () => {
      const run = spend(UNMARKED_CARD.id, UNMARKED, [WILD.id], { wildAs: ["energy"] });
      expect(run.dealt).toBe(1000 + 10000);
      expect(ofType(run.events, "wildTypesDeclared")).toHaveLength(0);
    });
  });

  it("an illegal answer to the choice is refused and the choice stays open", () => {
    const at = board(SPENDER.id, [WILD.id]);
    const paid = applyCommand(at.state, use(at, SPEND, fromHand(...at.hand)), deps);
    if (!paid.ok) throw new Error(paid.error.message);
    const choiceId = paid.state.pendingChoice?.choiceId;
    if (!choiceId) throw new Error("no choice");
    const answer = (selectedOptionIds: readonly string[]): Command => ({
      type: "resolveChoice",
      playerId: p1,
      choiceId,
      selectedOptionIds,
    });
    expect(refused(paid.state, answer([])).code).toBe("invalid_choice");
    expect(refused(paid.state, answer(["0:energy", "0:mental"])).code).toBe("invalid_choice");
    expect(refused(paid.state, answer(["1:energy"])).code).toBe("invalid_choice");
    const done = applyCommand(paid.state, answer(["0:energy"]), deps);
    expect(done.ok && villainDamage(done.state) - villainDamage(at.state)).toBe(100 + 1000 + 10000);
  });
});

describe("§3.62 (b) legalActions and the payment sheet", () => {
  const listed = (state: GameState, source: InstanceId) =>
    (() => {
      const actions = legalActions(state, p1, deps);
      if (actions.kind !== "turn") throw new Error(`not the player's turn: ${actions.kind}`);
      const match = (entry: { readonly action: { readonly kind: string; readonly instanceId?: InstanceId } }) =>
        entry.action.kind === "useAbility" && entry.action.instanceId === source;
      return { legal: actions.legal.find(match), illegal: actions.illegal.find(match) };
    })();

  it("lists the ability when the minimum can be met, though the whole hand is more than the maximum", () => {
    const at = board(SPENDER.id, [ENERGY.id, MENTAL.id, STRENGTH.id, GENIUS.id]);
    // Everything in hand together is well over 3 resources: paying with all of it is refused.
    expect(refused(at.state, use(at, SPEND, fromHand(...mustPlayer(at.state, p1).hand))).code).toBe("invalid_choice");
    const { legal } = listed(at.state, at.source);
    expect(legal).toBeDefined();
    expect(legal?.chosenResources).toEqual({ min: 1, max: 3 });
    expect(legal?.needsPayment).toBe(true);
    // The example spends the least it can, and the engine accepts it.
    const example = legal?.example as Command & { type: "useAbility" };
    expect(example.payment).toHaveLength(1);
    expect(applyCommand(at.state, example, deps).ok).toBe(true);
    expect(JSON.stringify(legal)).not.toContain("wildAs");
  });

  it("does not list it when nothing can be spent", () => {
    const at = board(SPENDER.id);
    const empty = handOnly(at.state, []);
    const { legal, illegal } = listed(empty, at.source);
    expect(legal).toBeUndefined();
    expect(illegal?.reason).toBe("insufficient_resources");
  });

  it("does not list a minimum of 2 with one resource to spend, and lists it with two", () => {
    const at = board(TWO_OR_THREE.id, [ENERGY.id, STRENGTH.id]);
    const one = handOnly(at.state, [at.hand[0] as InstanceId]);
    expect(listed(one, at.source).legal).toBeUndefined();
    expect(listed(one, at.source).illegal?.reason).toBe("insufficient_resources");
    const two = handOnly(at.state, at.hand);
    const example = listed(two, at.source).legal?.example as Command & { type: "useAbility" };
    expect(example.payment).toHaveLength(2);
  });

  it("does not list a size of exactly 1 when the only card has two icons: it cannot be overpaid", () => {
    const at = board(ONE_ONLY.id, [GENIUS.id, ENERGY.id]);
    const genius = handOnly(at.state, [at.hand[0] as InstanceId]);
    expect(listed(genius, at.source).legal).toBeUndefined();
    expect(listed(genius, at.source).illegal?.reason).toBe("invalid_choice");
    expect(listed(handOnly(at.state, at.hand), at.source).legal).toBeDefined();
  });

  it("a ready card in play that generates a resource is enough", () => {
    const at = board(SPENDER.id, [], [DYNAMO.id]);
    const empty = handOnly(at.state, []);
    const example = listed(empty, at.source).legal?.example as Command & { type: "useAbility" };
    expect(example.payment).toEqual([abilityOf(at, 0, DYNAMO_RESOURCE.ref.id)]);
  });

  it("paymentFor names the range and suggests a payment that fits; tryPayment judges a selection as the engine does", () => {
    const at = board(SPENDER.id, [ENERGY.id, MENTAL.id, STRENGTH.id, GENIUS.id]);
    const action = { kind: "useAbility", instanceId: at.source, abilityId: SPEND.ref.id } as const;
    const query = paymentFor(at.state, p1, action, {}, deps);
    expect(query?.chosenResources).toEqual({ min: 1, max: 3 });
    expect(query?.requirement).toEqual({ generic: 0, physical: 0, mental: 0, energy: 0 });
    expect(query?.suggested).toHaveLength(1);
    const ids = at.hand.map((id) => `hand:${id}`);
    expect(tryPayment(at.state, p1, action, ids.slice(0, 3), {}, deps).ok).toBe(true);
    const over = tryPayment(at.state, p1, action, ids, {}, deps);
    expect(over.ok === false && over.reason).toBe("invalid_choice");
  });
});

describe("§3.62 (b) an ability with an ordinary fixed resource cost is unchanged", () => {
  it("no prompt, overpaying allowed, the same events as ever", () => {
    const at = board(FIXED_CARD.id, [ENERGY.id, STRENGTH.id, WILD.id]);
    const before = villainDamage(at.state);
    const run = drive(at.state, [use(at, FIXED, fromHand(...at.hand))]);
    expect(run.asked).toBe(0);
    // 5 damage; two resources paid of the three generated, one overpaid.
    expect(villainDamage(run.state) - before).toBe(5 + 20000 + 1000000);
    expect(ofType(run.events, "wildTypesDeclared")).toHaveLength(0);
    // Paying, then the ability, then its three damage effects: no declaration step and no new event.
    const quiet = new Set(["framePushed", "framePopped", "triggerEvent"]);
    expect(run.events.map((e) => e.type).filter((type) => !quiet.has(type))).toEqual([
      "cardMoved",
      "cardDiscardedFromHand",
      "cardMoved",
      "cardDiscardedFromHand",
      "cardMoved",
      "cardDiscardedFromHand",
      "abilityResolved",
      "damageDealt",
      "damageDealt",
      "damageDealt",
    ]);
    expect(run.events.filter((e) => e.type === "framePushed")).toHaveLength(5);
    // Too little is refused as it always was.
    expect(refused(at.state, use(at, FIXED, fromHand(at.hand[0] as InstanceId))).message).toBe("need 2, paid 1");
  });

  it("legalActions reports no chosen size for it", () => {
    const at = board(FIXED_CARD.id, [ENERGY.id, STRENGTH.id]);
    const actions = legalActions(at.state, p1, deps);
    expect(JSON.stringify(actions)).not.toContain("chosenResources");
    expect(JSON.stringify(actions)).not.toContain("wildAs");
  });
});

describe("§3.62 test 10: Husk's Interrupt, paid for inside the window of her basic thwart", () => {
  /** Husk in play with 1 damage on her, 10 threat on the main scheme, and `cards` (only) in hand. */
  function huskBoard(cards: readonly CardId[]): Board {
    const at = board(HUSK.id, cards);
    const scheme = at.state.mainScheme.instanceId;
    const state: GameState = {
      ...handOnly(at.state, at.hand),
      instances: {
        ...at.state.instances,
        [scheme]: { ...mustInstance(at.state, scheme), threat: 10 },
        [at.source]: { ...mustInstance(at.state, at.source), damage: 1 },
      },
    };
    return { ...at, state };
  }
  const thwart = (at: Board): Command => ({
    type: "basicThwart",
    playerId: p1,
    thwarterInstanceId: at.source,
    schemeInstanceId: at.state.mainScheme.instanceId,
  });
  /** Answers the trigger prompt with Husk's Interrupt (or declines it) and the pay prompt with `pay`. */
  const answering =
    (trigger: boolean, pay: readonly InstanceId[]) =>
    (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseTriggers")
        return trigger ? choice.options.slice(0, 1).map((o) => o.optionId) : [];
      if (choice?.prompt.kind === "payForAbility") return pay.map((id) => `hand:${id}`);
      return defaultPick(state);
    };
  const threat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;

  it("she spends Plasmoid Energy ([energy][mental]): 3 threat removed, 1 damage healed from her", () => {
    const at = huskBoard([PLASMOID.id]);
    const run = drive(at.state, [thwart(at)], [], answering(true, at.hand));
    expect(run.asked).toBe(0);
    expect(threat(run.state)).toBe(10 - 3);
    // 1 damage healed, then 1 consequential damage for the thwart.
    expect(mustInstance(run.state, at.source).damage).toBe(1 - 1 + 1);
    expect(ofType(run.events, "damageHealed")).toHaveLength(1);
    expect(mustInstance(run.state, at.source).counters.physical ?? 0).toBe(0);
    expect(mustPlayer(run.state, p1).hand).toEqual([]);
  });

  it("she spends Strength instead: 2 removed, and the [physical] line alone resolves", () => {
    const at = huskBoard([STRENGTH.id]);
    const run = drive(at.state, [thwart(at)], [], answering(true, at.hand));
    expect(threat(run.state)).toBe(10 - 2);
    expect(mustInstance(run.state, at.source).counters.physical).toBe(1);
    expect(mustInstance(run.state, at.source).damage).toBe(1 + 1);
    expect(ofType(run.events, "damageHealed")).toHaveLength(0);
  });

  it("declined at the trigger prompt, or by selecting nothing at the pay prompt: 2 removed and nothing spent", () => {
    const at = huskBoard([PLASMOID.id]);
    for (const pick of [answering(false, []), answering(true, [])]) {
      const run = drive(at.state, [thwart(at)], [], pick);
      expect(threat(run.state)).toBe(10 - 2);
      expect(mustInstance(run.state, at.source).damage).toBe(1 + 1);
      expect(mustPlayer(run.state, p1).hand).toEqual([...at.hand]);
      expect(ofType(run.events, "abilityResolved")).toHaveLength(0);
    }
  });

  it("the pay prompt carries the range; a selection of four resources is refused and the prompt stays open", () => {
    const at = huskBoard([GENIUS.id, PLASMOID.id, STRENGTH.id]);
    const started = driveSession(startSession(at.state), deps, [thwart(at)], (state) =>
      state.pendingChoice?.prompt.kind === "payForAbility" ? [] : answering(true, [])(state),
    );
    // Driven with "select nothing", the pay prompt was declined; ask again by hand to look at it.
    expect(threat(started.session.state)).toBe(10 - 2);
    let state = at.state;
    const step = (command: Command): void => {
      const result = applyCommand(state, command, deps);
      if (!result.ok) throw new Error(result.error.message);
      state = result.state;
    };
    const answer = (selectedOptionIds: readonly string[]): Command => {
      const choice = state.pendingChoice;
      if (!choice) throw new Error("no choice");
      return { type: "resolveChoice", playerId: p1, choiceId: choice.choiceId, selectedOptionIds };
    };
    step(thwart(at));
    expect(state.pendingChoice?.prompt.kind).toBe("chooseTriggers");
    step(answer(state.pendingChoice?.options.slice(0, 1).map((o) => o.optionId) ?? []));
    expect(state.pendingChoice?.prompt).toEqual({
      kind: "payForAbility",
      instanceId: at.source,
      abilityId: HUSK_INTERRUPT.ref.id,
      cost: 0,
      chosenResources: { min: 1, max: 3, payingFor: at.source },
    });
    const [genius, plasmoid, strength] = at.hand as [InstanceId, InstanceId, InstanceId];
    const four = refused(state, answer([`hand:${genius}`, `hand:${plasmoid}`]));
    expect(four.code).toBe("invalid_choice");
    expect(four.message).toMatch(/spend from 1 to 3 resources; the selection is 4/);
    expect(state.pendingChoice?.prompt.kind).toBe("payForAbility");
    // Plasmoid Energy and Strength: three resources, all three lines.
    step(answer([`hand:${plasmoid}`, `hand:${strength}`]));
    expect(threat(state)).toBe(10 - 3);
    expect(mustInstance(state, at.source).counters.physical).toBe(1);
    expect(mustInstance(state, at.source).damage).toBe(1 - 1 + 1);
    expect(mustPlayer(state, p1).hand).toEqual([genius]);
  });

  it("(Q33 = B) she spends a wild: asked after the payment, before the Interrupt resolves; each answer its own line", () => {
    const at = huskBoard([WILD.id]);
    const by = (type: ResourceType) => drive(at.state, [thwart(at)], [[type]], answering(true, at.hand));
    const energy = by("energy");
    expect(energy.asked).toBe(1);
    expect(threat(energy.state)).toBe(10 - 3);
    expect(ofType(energy.events, "wildTypesDeclared")).toEqual([
      expect.objectContaining({ instanceId: at.source, abilityId: HUSK_INTERRUPT.ref.id, declared: ["energy"] }),
    ]);
    const mental = by("mental");
    expect(threat(mental.state)).toBe(10 - 2);
    expect(mustInstance(mental.state, at.source).damage).toBe(1 - 1 + 1);
    const physical = by("physical");
    expect(mustInstance(physical.state, at.source).counters.physical).toBe(1);
    const left = by("wild");
    expect(left.asked).toBe(1);
    expect(threat(left.state)).toBe(10 - 2);
    expect(mustInstance(left.state, at.source).damage).toBe(1 + 1);
    expect(mustInstance(left.state, at.source).counters.physical ?? 0).toBe(0);
  });

  it("with nothing she could spend the Interrupt is not offered", () => {
    const at = huskBoard([]);
    const prompts: string[] = [];
    const run = drive(at.state, [thwart(at)], [], (state) => {
      prompts.push(state.pendingChoice?.prompt.kind ?? "none");
      return defaultPick(state);
    });
    expect(prompts).not.toContain("chooseTriggers");
    expect(prompts).not.toContain("payForAbility");
    expect(threat(run.state)).toBe(10 - 2);
  });
});
