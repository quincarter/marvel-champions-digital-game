/**
 * `EffectSpec spendResources.required`: a spend the player already chose, as the "spend" option of a "choose to either
 * spend 1 resource of any type or place 1 threat on the main scheme".
 *
 * A player who chose an option resolves it, so the payment is made in full or not accepted, as a cost's is (RRG 1.8
 * "Cost", p. 13; overpaying is legal), and the option is offered only to a player who can pay it: RRG 1.8 "Choose
 * (Option)" (p. 12) for a player card ("cannot choose an option … [that has] a cost the player cannot pay"), and for
 * an encounter card the owner's standing default (docs/phase7-wave7.md §4.2 Q8 = A; that paragraph of the RRG names
 * only options without targets). The spend without the flag is still the "either spend … or" prompt where paying
 * nothing declines and the alternative follows on `<bind>.made`. Synthetic cards only.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { ResourceRequirement } from "./resources.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubResource } from "./testing/fixtures.js";
import { giveCard, giveCards } from "./testing/scenario.js";
import { gameAtFirstTurn, P1 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const you = { kind: "controller" } as const;
const n = (value: number) => ({ kind: "const", value }) as const;

const PHYS = stubResource({ id: "sr-phys", icons: 0, produces: { physical: 1 } });
const MENT = stubResource({ id: "sr-ment", icons: 0, produces: { mental: 1 } });

const spend = (
  resources: ResourceRequirement,
  extra: { required?: true; distinctTypes?: number } = {},
): EffectSpec => ({
  kind: "spendResources",
  player: you,
  resources,
  bind: "spent",
  ...extra,
});
const PLACE_THREAT: EffectSpec = { kind: "placeThreat", target: { kind: "mainScheme" }, amount: n(1) };
/** What follows the choice, whichever option was taken: "Remove 1 bystander counter" stands in as a counter placed. */
const AFTERWARD: EffectSpec = {
  kind: "addCounters",
  target: { kind: "villain" },
  counterType: "resolved",
  amount: n(1),
};
/** Records that the spend was made. */
const IF_SPENT: EffectSpec = {
  kind: "if",
  condition: { kind: "varAtLeast", name: "spent.made", amount: 1 },
  then: [{ kind: "addCounters", target: { kind: "villain" }, counterType: "paid", amount: n(1) }],
};

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, def({ trigger: { kind: "action" }, effects }));
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const eitherOr = (id: string, spendEffect: EffectSpec) =>
  action(id, [
    {
      kind: "chooseOne",
      chooser: you,
      options: [
        { label: "Spend", effects: [spendEffect] },
        { label: "Place 1 threat on the main scheme", effects: [PLACE_THREAT] },
      ],
    },
    IF_SPENT,
    AFTERWARD,
  ]);
/** "Choose to either spend 1 resource of any type or place 1 threat on the main scheme." */
const BYSTANDERS = eitherOr("sr-bystanders", spend({ generic: 1 }, { required: true }));
/** "Choose to either spend [physical][physical] resources or place 1 threat on the main scheme." */
const EARTHQUAKE = eitherOr("sr-earthquake", spend({ physical: 2 }, { required: true }));
/** "Choose to either spend 2 different resources or place 1 threat on the main scheme." */
const DIRECTIONS = eitherOr("sr-directions", spend({ generic: 2 }, { required: true, distinctTypes: 2 }));
/** The older shape: "Either spend 1 resource or place 1 threat", the spend itself being the choice. */
const MAY_SPEND = action("sr-may-spend", [
  spend({ generic: 1 }),
  {
    kind: "if",
    condition: { kind: "not", of: { kind: "varAtLeast", name: "spent.made", amount: 1 } },
    then: [PLACE_THREAT],
  },
  IF_SPENT,
  AFTERWARD,
]);
/** A required spend with no choice around it. */
const MUST_SPEND = action("sr-must-spend", [spend({ generic: 1 }, { required: true }), IF_SPENT, AFTERWARD]);
const EVENTS = [BYSTANDERS, EARTHQUAKE, DIRECTIONS, MAY_SPEND, MUST_SPEND];

const CARDS = [PHYS, MENT, ...EVENTS.map((e) => e.card)];
const deps = depsOf(...EVENTS.map((e) => e.ability));
const DECK: readonly CardId[] = CARDS.flatMap((card) => [card.id, card.id, card.id]);

/** A game whose first player holds exactly `hand` (the rest of the hand goes under the deck): test surgery. */
function withHand(hand: readonly string[], player: PlayerId = P1): GameState {
  const given = giveCards(gameAtFirstTurn({ cards: CARDS, deps, deck: DECK }), player, ...hand);
  return {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === player
        ? { ...p, hand: [...given.ids], deck: [...p.deck, ...p.hand.filter((id) => !given.ids.includes(id))] }
        : p,
    ),
  };
}

interface Table {
  session: GameSession;
  readonly events: GameEvent[];
}
/** Plays `card` for nothing and stops at the first choice it asks, if any. */
function playing(state: GameState, card: (typeof EVENTS)[number]): Table {
  const given = giveCard(state, P1, card.card.id);
  const result = sessionApply(
    startSession(given.state),
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return { session: result.session, events: [...result.events] };
}
/** Answers the pending choice; returns the refusal when the engine does not accept the answer. */
function answer(table: Table, selectedOptionIds: readonly string[]): string | null {
  const choice = table.session.state.pendingChoice!;
  const result = sessionApply(
    table.session,
    { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds },
    deps,
  );
  if (!result.ok) return `${result.error.code}: ${result.error.message}`;
  table.session = result.session;
  table.events.push(...result.events);
  return null;
}
const pending = (table: Table) => table.session.state.pendingChoice;
const labels = (table: Table) => pending(table)?.options.map((o) => o.label);
const pick = (table: Table, label: string) =>
  answer(table, [pending(table)!.options.find((o) => o.label === label)!.optionId]);
const handCards = (table: Table, card: string): InstanceId[] =>
  mustPlayer(table.session.state, P1).hand.filter((id) => mustInstance(table.session.state, id).cardId === card);
const pay = (...ids: readonly InstanceId[]) => ids.map((id) => `hand:${id}`);
const hand = (table: Table) => mustPlayer(table.session.state, P1).hand.length;
const threat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
const villainCounters = (table: Table) =>
  mustInstance(table.session.state, table.session.state.villains[0]!.instanceId).counters;

describe("a required spend: the 'spend' option of a choice (RRG 1.8 pp. 12, 13)", () => {
  it("chosen by a player who can pay: paying nothing is refused and the choice stays open; paying 1 card spends it", () => {
    const start = withHand([PHYS.id, MENT.id]);
    const table = playing(start, BYSTANDERS);
    expect(labels(table)).toEqual(["Spend", "Place 1 threat on the main scheme"]);
    expect(pick(table, "Spend")).toBeNull();
    expect(pending(table)).toMatchObject({
      prompt: { kind: "spendResources", requirement: { generic: 1 }, required: true },
      minSelections: 1,
    });

    const open = table.session.state;
    expect(answer(table, [])).toMatch(/^invalid_choice/);
    expect(table.session.state).toBe(open); // refused: nothing changed, the same choice is pending

    const [phys] = handCards(table, PHYS.id);
    expect(answer(table, pay(phys!))).toBeNull();
    expect(pending(table)).toBeNull();
    expect(hand(table)).toBe(1);
    expect(mustPlayer(table.session.state, P1).discard).toContain(phys);
    expect(threat(table.session.state)).toBe(threat(start));
    expect(villainCounters(table)).toMatchObject({ paid: 1, resolved: 1 });

    const replayed = replay(table.session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(table.session.state);
  });

  it("the other option is still the player's to take while they can pay", () => {
    const start = withHand([PHYS.id]);
    const table = playing(start, BYSTANDERS);
    expect(pick(table, "Place 1 threat on the main scheme")).toBeNull();
    expect(pending(table)).toBeNull();
    expect(hand(table)).toBe(1);
    expect(threat(table.session.state)).toBe(threat(start) + 1);
    expect(villainCounters(table)).toEqual({ resolved: 1 });
  });

  it("[physical][physical]: one physical, or a physical and a mental, is too little and is refused; two physical pay; a third card overpays", () => {
    const start = withHand([PHYS.id, PHYS.id, MENT.id]);
    const table = playing(start, EARTHQUAKE);
    expect(pick(table, "Spend")).toBeNull();
    const [first, second] = handCards(table, PHYS.id);
    const [ment] = handCards(table, MENT.id);
    expect(answer(table, pay(first!))).toMatch(/^invalid_choice/);
    expect(answer(table, pay(first!, ment!))).toMatch(/^invalid_choice/);
    expect(hand(table)).toBe(3);
    expect(answer(table, pay(first!, second!))).toBeNull();
    expect(hand(table)).toBe(1);
    expect(villainCounters(table)).toMatchObject({ paid: 1, resolved: 1 });

    const over = playing(start, EARTHQUAKE);
    pick(over, "Spend");
    expect(answer(over, pay(...handCards(over, PHYS.id), ...handCards(over, MENT.id)))).toBeNull();
    expect(hand(over)).toBe(0);
    expect(villainCounters(over)).toMatchObject({ paid: 1, resolved: 1 });
  });

  it("the first `minSelections` options are a payment in full: [physical][physical] from a mental and two physical lists the two physical first and asks for 2", () => {
    const table = playing(withHand([MENT.id, PHYS.id, PHYS.id]), EARTHQUAKE);
    expect(pick(table, "Spend")).toBeNull();
    const choice = pending(table)!;
    expect(choice.minSelections).toBe(2);
    expect(choice.options.map((o) => o.optionId)).toEqual([
      ...pay(...handCards(table, PHYS.id)),
      ...pay(...handCards(table, MENT.id)),
    ]);
    expect(
      answer(
        table,
        choice.options.slice(0, choice.minSelections).map((o) => o.optionId),
      ),
    ).toBeNull();
    expect(hand(table)).toBe(1);
    expect(villainCounters(table)).toMatchObject({ paid: 1, resolved: 1 });
  });

  it("'2 different resources': two of one type are refused, one of each pays", () => {
    const table = playing(withHand([PHYS.id, PHYS.id, MENT.id]), DIRECTIONS);
    expect(pick(table, "Spend")).toBeNull();
    expect(pending(table)).toMatchObject({ prompt: { kind: "spendResources", required: true, distinctTypes: 2 } });
    expect(answer(table, pay(...handCards(table, PHYS.id)))).toMatch(/^invalid_choice/);
    expect(answer(table, pay(handCards(table, PHYS.id)[0]!, handCards(table, MENT.id)[0]!))).toBeNull();
    expect(hand(table)).toBe(1);
    expect(villainCounters(table)).toMatchObject({ paid: 1 });
  });

  it("a player who cannot pay is not offered the option: the other resolves without a choice", () => {
    const empty = withHand([]);
    const none = playing(empty, BYSTANDERS);
    expect(pending(none)).toBeNull();
    expect(threat(none.session.state)).toBe(threat(empty) + 1);
    expect(villainCounters(none)).toEqual({ resolved: 1 });

    // One physical card does not pay [physical][physical].
    const short = withHand([PHYS.id, MENT.id]);
    const one = playing(short, EARTHQUAKE);
    expect(pending(one)).toBeNull();
    expect(hand(one)).toBe(2);
    expect(threat(one.session.state)).toBe(threat(short) + 1);
  });

  it("with no choice around it and nothing to pay with, nobody is asked and `<bind>.made` is 0", () => {
    const table = playing(withHand([]), MUST_SPEND);
    expect(pending(table)).toBeNull();
    expect(villainCounters(table)).toEqual({ resolved: 1 });

    const able = playing(withHand([MENT.id]), MUST_SPEND);
    expect(answer(able, [])).toMatch(/^invalid_choice/);
    expect(answer(able, pay(...handCards(able, MENT.id)))).toBeNull();
    expect(villainCounters(able)).toMatchObject({ paid: 1, resolved: 1 });
  });
});

describe("a spend without `required` is still the 'either spend … or' prompt", () => {
  it("paying nothing declines: nothing is spent and the alternative follows", () => {
    const start = withHand([PHYS.id]);
    const table = playing(start, MAY_SPEND);
    expect(pending(table)).toMatchObject({ prompt: { kind: "spendResources" }, minSelections: 0 });
    expect(pending(table)!.prompt).not.toHaveProperty("required");
    expect(answer(table, [])).toBeNull();
    expect(hand(table)).toBe(1);
    expect(threat(table.session.state)).toBe(threat(start) + 1);
    expect(villainCounters(table)).toEqual({ resolved: 1 });
  });

  it("paying spends the card and skips the alternative", () => {
    const start = withHand([PHYS.id]);
    const table = playing(start, MAY_SPEND);
    expect(answer(table, pay(...handCards(table, PHYS.id)))).toBeNull();
    expect(hand(table)).toBe(0);
    expect(threat(table.session.state)).toBe(threat(start));
    expect(villainCounters(table)).toMatchObject({ paid: 1, resolved: 1 });
  });
});
