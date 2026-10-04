/**
 * docs/phase7-wave6.md §3.69: spending different resources as an effect. Director's Directions (`mojo` 39033): "Choose
 * one: • Spend 2 different resources. • …". `EffectSpec spendResources.distinctTypes` holds the payment to the rule the
 * cost field `AbilityCost.distinctResourceTypes` already uses (`distinctTypeCount`).
 *
 * Sources: RRG 1.8 "Wild Resource" (p. 48: a generated wild is used as "energy, mental, physical, or wild"), "Resource"
 * (p. 37), "Cost" (p. 13: resources generated beyond what is asked are overpaid).
 */

import type { AnyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { PendingChoice } from "./choices.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import { distinctTypeCount, EMPTY_POOL } from "./resources.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { defaultPick, giveCards } from "./testing/scenario.js";
import { stubEvent, stubResource } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, P1 } from "./testing/wave3.js";

const controller = { kind: "controller" } as const;

const PHYSICAL = stubResource({ id: "physical", icons: 0, produces: { physical: 1 } });
const MENTAL = stubResource({ id: "mental", icons: 0, produces: { mental: 1 } });
const WILD = stubResource({ id: "wild", icons: 1 });
/** Two icons of one type on one card (Strength's shape). */
const DOUBLE_PHYSICAL = stubResource({ id: "double-physical", icons: 0, produces: { physical: 2 } });
/** Two icons of different types on one card. */
const SPLIT = stubResource({ id: "split", icons: 0, produces: { physical: 1, energy: 1 } });
const RESOURCES = [PHYSICAL, MENTAL, WILD, DOUBLE_PHYSICAL, SPLIT];

/** "Spend … . If you do not, take 3 damage": the damage tells a payment that was made from one that was not. */
const spendOrTakeThree = (spend: Partial<Extract<EffectSpec, { kind: "spendResources" }>>): EffectSpec[] => [
  { kind: "spendResources", player: controller, resources: { generic: 2 }, bind: "spent", ...spend },
  {
    kind: "if",
    condition: { kind: "not", of: { kind: "varAtLeast", name: "spent.made", amount: 1 } },
    then: [
      { kind: "dealDamage", target: { kind: "identityOf", player: controller }, amount: { kind: "const", value: 3 } },
    ],
  },
];
const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** Director's Directions' first option: "Spend 2 different resources." */
const TWO_DIFFERENT = action("two-different", spendOrTakeThree({ distinctTypes: 2 }));
/** The same spend without the rule: "spend 2 resources". */
const TWO_ANY = action("two-any", spendOrTakeThree({}));
const THREE_DIFFERENT = action("three-different", spendOrTakeThree({ resources: { generic: 3 }, distinctTypes: 3 }));
const ACTIONS = [TWO_DIFFERENT, TWO_ANY, THREE_DIFFERENT];

const deps: EngineDeps = depsOf(...ACTIONS.map((a) => a.ability));
const CARDS: readonly AnyCard[] = [...RESOURCES, ...ACTIONS.map((a) => a.card)];

const start = (): GameState =>
  gameAtFirstTurn({
    deps,
    cards: CARDS,
    deck: [...RESOURCES.flatMap((r) => copiesOf(r.id, 2)), ...ACTIONS.flatMap((a) => copiesOf(a.card.id, 2))],
  });

interface Parked {
  readonly session: GameSession;
  /** The hand cards handed out for the payment, in the order asked for. */
  readonly ids: readonly InstanceId[];
}

/** Hands P1 `resources` and `card`, plays `card` for free, and stops at its `spendResources` choice. */
function atSpend(card: (typeof ACTIONS)[number], ...resources: readonly (typeof RESOURCES)[number][]): Parked {
  const given = giveCards(start(), P1, card.card.id, ...resources.map((r) => r.id));
  const [cardInstanceId, ...ids] = given.ids as [InstanceId, ...InstanceId[]];
  const result = sessionApply(
    startSession(given.state),
    { type: "playCard", playerId: P1, cardInstanceId, payment: [], attachToInstanceId: null },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  if (result.session.state.pendingChoice?.prompt.kind !== "spendResources") throw new Error("no spend choice opened");
  return { session: result.session, ids };
}

/** Answers the spend choice with those hand cards; later choices take their default. */
function pay(
  parked: Parked,
  ...cards: readonly InstanceId[]
): { readonly session: GameSession; readonly state: GameState; readonly events: readonly GameEvent[] } {
  const choice = parked.session.state.pendingChoice as PendingChoice;
  const result = sessionApply(
    parked.session,
    {
      type: "resolveChoice",
      playerId: choice.playerId,
      choiceId: choice.choiceId,
      selectedOptionIds: cards.map((id) => `hand:${id}`),
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  const rest = driveSession(result.session, deps, [], defaultPick);
  return { session: rest.session, state: rest.session.state, events: [...result.events, ...rest.events] };
}

const damageOn = (state: GameState): number => mustInstance(state, state.players[0]!.identity.instanceId).damage;
const hand = (state: GameState): readonly InstanceId[] => mustPlayer(state, P1).hand;
const discard = (state: GameState): readonly InstanceId[] => mustPlayer(state, P1).discard;

/** The payment was made: the cards are in the discard pile and the alternative did not resolve. */
function expectPaid(state: GameState, ids: readonly InstanceId[]): void {
  for (const id of ids) expect(discard(state)).toContain(id);
  expect(damageOn(state)).toBe(0);
}
/** The payment was not made: every card is still in hand and the alternative resolved. */
function expectNotPaid(state: GameState, ids: readonly InstanceId[]): void {
  for (const id of ids) expect(hand(state)).toContain(id);
  expect(damageOn(state)).toBe(3);
}

describe("§3.69 distinctTypeCount: how many types a payment can be counted as", () => {
  const pool = (parts: Partial<typeof EMPTY_POOL>) => ({ ...EMPTY_POOL, ...parts });
  it.each([
    { parts: {}, types: 0 },
    { parts: { physical: 3 }, types: 1 },
    { parts: { physical: 1, mental: 1 }, types: 2 },
    { parts: { physical: 2, mental: 1, energy: 4 }, types: 3 },
    // A wild is one more type not otherwise present.
    { parts: { physical: 2, wild: 1 }, types: 2 },
    { parts: { wild: 1 }, types: 1 },
    // Two wilds are two types (RRG 1.8 p. 48); four is every type there is.
    { parts: { wild: 2 }, types: 2 },
    { parts: { physical: 1, mental: 1, energy: 1, wild: 1 }, types: 4 },
    { parts: { physical: 1, mental: 1, energy: 1, wild: 3 }, types: 4 },
    { parts: { wild: 9 }, types: 4 },
  ])("$parts is $types", ({ parts, types }) => {
    expect(distinctTypeCount(pool(parts))).toBe(types);
  });
});

describe("§3.69 spendResources.distinctTypes: the choice", () => {
  it("the prompt carries the rule beside the requirement; nothing has to be selected", () => {
    const { session, ids } = atSpend(TWO_DIFFERENT, PHYSICAL, MENTAL);
    const choice = session.state.pendingChoice;
    expect(choice?.prompt).toEqual({
      kind: "spendResources",
      requirement: { generic: 2, physical: 0, mental: 0, energy: 0 },
      distinctTypes: 2,
    });
    expect(choice).toMatchObject({ playerId: P1, minSelections: 0, authority: "player" });
    expect(choice?.maxSelections).toBe(choice?.options.length);
    for (const id of ids) expect(choice?.options.map((o) => o.optionId)).toContain(`hand:${id}`);
    expect(legalActions(session.state, P1, deps)).toEqual({ kind: "choice", choice });
  });

  it("a spend without the rule has no `distinctTypes` in its prompt", () => {
    const { session } = atSpend(TWO_ANY, PHYSICAL, PHYSICAL);
    expect(session.state.pendingChoice?.prompt).toEqual({
      kind: "spendResources",
      requirement: { generic: 2, physical: 0, mental: 0, energy: 0 },
    });
  });
});

describe("§3.69 spendResources.distinctTypes: 'Spend 2 different resources'", () => {
  it("a physical and a mental resource pay", () => {
    const parked = atSpend(TWO_DIFFERENT, PHYSICAL, MENTAL);
    expectPaid(pay(parked, ...parked.ids).state, parked.ids);
  });

  it("two physical resources do not: nothing is spent and the spend was not made", () => {
    const parked = atSpend(TWO_DIFFERENT, PHYSICAL, PHYSICAL);
    expectNotPaid(pay(parked, ...parked.ids).state, parked.ids);
  });

  it("the same two physical resources pay a plain 'spend 2 resources'", () => {
    const parked = atSpend(TWO_ANY, PHYSICAL, PHYSICAL);
    expectPaid(pay(parked, ...parked.ids).state, parked.ids);
  });

  it("one card with two physical icons does not pay", () => {
    const parked = atSpend(TWO_DIFFERENT, DOUBLE_PHYSICAL);
    expectNotPaid(pay(parked, ...parked.ids).state, parked.ids);
  });

  it("one card with a physical and an energy icon pays by itself", () => {
    const parked = atSpend(TWO_DIFFERENT, SPLIT);
    expectPaid(pay(parked, ...parked.ids).state, parked.ids);
  });

  it("a wild is any one type: physical and wild pay, and so do two wilds", () => {
    const mixed = atSpend(TWO_DIFFERENT, PHYSICAL, WILD);
    expectPaid(pay(mixed, ...mixed.ids).state, mixed.ids);
    const wilds = atSpend(TWO_DIFFERENT, WILD, WILD);
    expectPaid(pay(wilds, ...wilds.ids).state, wilds.ids);
  });

  it("two types but one resource short is too little", () => {
    // Different types alone are not enough: the amount still has to be met.
    const parked = atSpend(THREE_DIFFERENT, PHYSICAL, MENTAL);
    expectNotPaid(pay(parked, ...parked.ids).state, parked.ids);
  });

  it("three resources of two types do not pay 'spend 3 different resources'; a wild third type does", () => {
    const short = atSpend(THREE_DIFFERENT, DOUBLE_PHYSICAL, MENTAL);
    expectNotPaid(pay(short, ...short.ids).state, short.ids);
    const enough = atSpend(THREE_DIFFERENT, PHYSICAL, MENTAL, WILD);
    expectPaid(pay(enough, ...enough.ids).state, enough.ids);
  });

  it("selecting nothing declines", () => {
    const parked = atSpend(TWO_DIFFERENT, PHYSICAL, MENTAL);
    expectNotPaid(pay(parked).state, parked.ids);
  });

  it("a payment holding more than is asked still pays, and every selected card is spent", () => {
    const parked = atSpend(TWO_DIFFERENT, PHYSICAL, PHYSICAL, MENTAL);
    expectPaid(pay(parked, ...parked.ids).state, parked.ids);
  });
});

describe("§3.69 spendResources.distinctTypes: the log", () => {
  it("a paid spend replays to an identical state", () => {
    const parked = atSpend(TWO_DIFFERENT, PHYSICAL, MENTAL);
    const { session } = pay(parked, ...parked.ids);
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
  });

  it("a refused spend replays to an identical state", () => {
    const parked = atSpend(TWO_DIFFERENT, PHYSICAL, PHYSICAL);
    const { session } = pay(parked, ...parked.ids);
    const replayed = replay(session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(session.state);
    expect(replayed.ok && damageOn(replayed.state)).toBe(3);
  });
});
