/**
 * docs/phase7-wave7.md §3.47: `TargetQuery.minPrintedCost`, "a printed cost of N or more", the lower bound beside
 * `maxPrintedCost` and read the same way through `printedCostOf`. Synthetic cards shaped like the constant it serves:
 * "Reduce the cost to play each event with a printed cost of 3 or more by 1", an existing `costModifiers` rule whose
 * `appliesTo` carries the new clause.
 *
 * Sources: RRG 1.8 "Printed" (p. 35): "the text, characteristic, or value that is physically printed on the card", so
 * a cost modifier moves what is paid and never what the filter reads. RRG 1.8 "Per Player Icon" (p. 32) and the
 * ruling of Aug 3, 2026 (5): "Printed cost scales with player count". RRG 1.8 "Dash (Value)" (p. 15): "If a game step
 * or card ability references a value of dash (–), that value is treated as an unmodifiable 0." RRG 1.8 "Non-Numerical
 * Variable" (p. 30): "If the variable is not defined …, treat that variable as being equal to 0", and for a cost of
 * X "the amount paid may be modified by effects without changing the value of X".
 */

import type { AllyCard, CardId, EventCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import { playCostOf } from "./actions.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustPlayer, printedCostOf } from "./query.js";
import { explainQuery, matchesQuery, type EffectContext } from "./select.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubResource, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard, giveCards } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;

const DRAW_ACTION = stubAbility(
  "draw.action",
  def({
    trigger: { kind: "action" },
    effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
  }),
);
const event = (id: string, cost: number): EventCard => stubEvent({ id, cost, abilities: [DRAW_ACTION.ref] });

const ONE = event("one", 1);
const TWO = event("two", 2);
const THREE = event("three", 3);
const FOUR = event("four", 4);
/** A printed "—" and a printed "X": both stored as cost 0 with the mark in `specialCost`. */
const DASHED: EventCard = { ...event("dashed", 0), specialCost: "dash" };
const VARIABLE: EventCard = { ...event("variable", 0), specialCost: "X" };
/** "2[per_hero]". */
const TEAM: EventCard = { ...event("team", 2), costPerPlayer: true };
/** Costed cards of the types the rule does not name. */
const ALLY: AllyCard = stubAlly({ id: "ally", cost: 3, atk: 1, thw: 1, hp: 3 });
const UPGRADE = stubUpgrade({ id: "upgrade", cost: 3 });
/** A card that prints no cost at all. */
const PLAIN = stubResource({ id: "plain", icons: 1 });

const EXPENSIVE_EVENT: TargetQuery = { categories: ["event"], minPrintedCost: 3 };
/** "Reduce the cost to play each event with a printed cost of 3 or more by 1." */
const MANEUVERS_RULE = stubAbility(
  "maneuvers.constant",
  def({ trigger: { kind: "constant", costModifiers: [{ delta: -1, appliesTo: EXPENSIVE_EVENT }] }, effects: [] }),
);
const MANEUVERS = stubSupport({ id: "maneuvers", cost: 0, abilities: [MANEUVERS_RULE.ref] });
/** The same rule at 9: more than any of these events costs, to show the floor. */
const DEEP_RULE = stubAbility(
  "deep.constant",
  def({ trigger: { kind: "constant", costModifiers: [{ delta: -9, appliesTo: EXPENSIVE_EVENT }] }, effects: [] }),
);
const DEEP = stubSupport({ id: "deep", cost: 0, abilities: [DEEP_RULE.ref] });

const CARDS = [ONE, TWO, THREE, FOUR, DASHED, VARIABLE, TEAM, ALLY, UPGRADE, PLAIN, MANEUVERS, DEEP];
const deps = depsOf(DRAW_ACTION, MANEUVERS_RULE, DEEP_RULE);
const DECK: readonly CardId[] = [...CARDS.map((card) => card.id), ...copiesOf(PLAIN.id, 8)];

const start = (players: 1 | 2 = 1): GameState => gameAtFirstTurn({ cards: CARDS, deps, players, deck: DECK });
const contextOf = (state: GameState): EffectContext => ({
  selfInstanceId: mustPlayer(state, P1).identity.instanceId,
  controllerId: P1,
  event: null,
  bindings: {},
  deps,
});
/** P1 holding one copy of each card named, in order. */
function holding(state: GameState, ...cards: readonly CardId[]) {
  const given = giveCards(state, P1, ...cards);
  return { state: given.state, ids: given.ids };
}
/** P1 holding `card` and `resources` one-icon resource cards. */
function priced(state: GameState, card: CardId, resources: number) {
  const given = giveCards(state, P1, card, ...copiesOf(PLAIN.id, resources));
  const [subject, ...paid] = given.ids as [InstanceId, ...InstanceId[]];
  return { state: given.state, subject, paid };
}
const fromHand = (...ids: readonly InstanceId[]): readonly Payment[] => ids.map((id) => ({ fromHand: id }));
const play = (card: InstanceId, payment: readonly Payment[], x?: number): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment,
  attachToInstanceId: null,
  ...(x === undefined ? {} : { x }),
});
const run = (state: GameState, ...commands: readonly Command[]): GameState =>
  driveSession(startSession(state), deps, commands, defaultPick).session.state;
/** The error code a command is refused with, or null when it is accepted. */
const refusal = (state: GameState, command: Command): string | null => {
  const result = applyCommand(state, command, deps);
  return result.ok ? null : result.error.code;
};
/** Which of `ids` the query matches, as booleans in order. */
const matching = (state: GameState, ids: readonly InstanceId[], query: TargetQuery): readonly boolean[] =>
  ids.map((id) => matchesQuery(state, id, query, contextOf(state)));

describe("§3.47 minPrintedCost: a printed cost of N or more", () => {
  it("matches at exactly N and above, and not below", () => {
    const { state, ids } = holding(start(), ONE.id, TWO.id, THREE.id, FOUR.id);
    expect(matching(state, ids, { minPrintedCost: 3 })).toEqual([false, false, true, true]);
    expect(matching(state, ids, { minPrintedCost: 2 })).toEqual([false, true, true, true]);
    expect(matching(state, ids, { minPrintedCost: 5 })).toEqual([false, false, false, false]);
    const [, two, three] = ids;
    expect(explainQuery(state, two!, { minPrintedCost: 3 }, contextOf(state))).toBe("printedCostTooLow");
    expect(explainQuery(state, three!, { minPrintedCost: 3 }, contextOf(state))).toBeNull();
  });

  it("takes a value as its bound, like maxPrintedCost", () => {
    const { state, ids } = holding(start(), TWO.id, THREE.id);
    expect(matching(state, ids, { minPrintedCost: { kind: "const", value: 3 } })).toEqual([false, true]);
    // "A printed cost equal to or greater than that card's": the bound is read from another card.
    const bound = { kind: "printedCost", of: { kind: "self" } } as const;
    const context = { ...contextOf(state), selfInstanceId: ids[1]! };
    expect(ids.map((id) => matchesQuery(state, id, { minPrintedCost: bound }, context))).toEqual([false, true]);
  });

  it("with maxPrintedCost selects a band", () => {
    const { state, ids } = holding(start(), ONE.id, TWO.id, THREE.id, FOUR.id);
    expect(matching(state, ids, { minPrintedCost: 2, maxPrintedCost: 3 })).toEqual([false, true, true, false]);
    expect(matching(state, ids, { minPrintedCost: 3, maxPrintedCost: 3 })).toEqual([false, false, true, false]);
    // An empty band matches nothing.
    expect(matching(state, ids, { minPrintedCost: 4, maxPrintedCost: 2 })).toEqual([false, false, false, false]);
  });

  it("a dash, an X and a card with no cost read as 0: never 'N or more' above 0", () => {
    const { state, ids } = holding(start(), DASHED.id, VARIABLE.id, PLAIN.id);
    expect([DASHED, VARIABLE, PLAIN].map((card) => printedCostOf(state, card))).toEqual([0, 0, 0]);
    expect(matching(state, ids, { minPrintedCost: 1 })).toEqual([false, false, false]);
    expect(matching(state, ids, { minPrintedCost: 3 })).toEqual([false, false, false]);
    // The 0 they are treated as is still compared, the way maxPrintedCost compares it.
    expect(matching(state, ids, { minPrintedCost: 0 })).toEqual([true, true, true]);
    expect(matching(state, ids, { maxPrintedCost: 0 })).toEqual([true, true, true]);
  });

  it.each([
    [1, 2, false],
    [2, 4, true],
  ] as const)("%i player(s): a '2 per player' cost is compared as %i", (players, printed, qualifies) => {
    const { state, ids } = holding(start(players), TEAM.id);
    expect(printedCostOf(state, TEAM)).toBe(printed);
    expect(matching(state, ids, EXPENSIVE_EVENT)).toEqual([qualifies]);
    expect(matching(state, ids, { minPrintedCost: printed })).toEqual([true]);
    expect(matching(state, ids, { minPrintedCost: printed + 1 })).toEqual([false]);
  });
});

describe("§3.47 'reduce the cost to play each event with a printed cost of 3 or more by 1'", () => {
  const withRule = (players: 1 | 2 = 1): GameState => playerCardIntoPlay(start(players), MANEUVERS.id).state;

  it("a 3-cost event costs 2 and is paid for at 2", () => {
    const { state, subject, paid } = priced(withRule(), THREE.id, 2);
    expect(playCostOf(state, P1, subject, deps)).toMatchObject({ printed: 3, current: 2 });
    expect(refusal(state, play(subject, fromHand(...paid.slice(1))))).toBe("insufficient_resources");
    const after = run(state, play(subject, fromHand(...paid)));
    expect(mustPlayer(after, P1).discard).toEqual(expect.arrayContaining([subject, ...paid]));
  });

  it("the filter reads the printed 3, not the 2 being paid", () => {
    const { state, subject } = priced(withRule(), THREE.id, 0);
    expect(playCostOf(state, P1, subject, deps)?.current).toBe(2);
    expect(printedCostOf(state, THREE)).toBe(3);
    expect(matching(state, [subject], EXPENSIVE_EVENT)).toEqual([true]);
    // Two copies of the rule both still see "3 or more": the first does not take the card out of the second's reach.
    const twice = playerCardIntoPlay(state, DEEP.id).state;
    expect(playCostOf(twice, P1, subject, deps)?.contributions.map((entry) => entry.delta)).toEqual([-1, -9]);
  });

  it("a 2-cost event still costs 2, and a 4-cost event costs 3", () => {
    const two = priced(withRule(), TWO.id, 2);
    expect(playCostOf(two.state, P1, two.subject, deps)).toMatchObject({ printed: 2, current: 2, contributions: [] });
    expect(refusal(two.state, play(two.subject, fromHand(...two.paid.slice(1))))).toBe("insufficient_resources");
    expect(mustPlayer(run(two.state, play(two.subject, fromHand(...two.paid))), P1).discard).toContain(two.subject);
    const four = priced(withRule(), FOUR.id, 3);
    expect(playCostOf(four.state, P1, four.subject, deps)).toMatchObject({ printed: 4, current: 3 });
    expect(mustPlayer(run(four.state, play(four.subject, fromHand(...four.paid))), P1).discard).toContain(four.subject);
  });

  it("a card type the rule does not name is unaffected", () => {
    for (const card of [ALLY, UPGRADE]) {
      const given = giveCard(withRule(), P1, card.id);
      expect(playCostOf(given.state, P1, given.id, deps)).toMatchObject({ printed: 3, current: 3, contributions: [] });
    }
    const { state, subject, paid } = priced(withRule(), ALLY.id, 3);
    expect(refusal(state, play(subject, fromHand(...paid.slice(1))))).toBe("insufficient_resources");
    expect(mustPlayer(run(state, play(subject, fromHand(...paid))), P1).playArea).toContain(subject);
  });

  it("the reduced cost stops at 0", () => {
    const deep = playerCardIntoPlay(start(), DEEP.id).state;
    const { state, subject } = priced(deep, THREE.id, 0);
    expect(playCostOf(state, P1, subject, deps)).toMatchObject({ printed: 3, current: 0 });
    expect(mustPlayer(run(state, play(subject, [])), P1).discard).toContain(subject);
    const cheap = giveCard(deep, P1, TWO.id);
    expect(playCostOf(cheap.state, P1, cheap.id, deps)).toMatchObject({ printed: 2, current: 2 });
  });

  it.each([
    [1, 2],
    [2, 3],
  ] as const)("%i player(s): a '2 per player' event costs %i", (players, current) => {
    const { state, subject, paid } = priced(withRule(players), TEAM.id, current);
    expect(playCostOf(state, P1, subject, deps)).toMatchObject({ printed: 2 * players, current });
    expect(refusal(state, play(subject, fromHand(...paid.slice(1))))).toBe("insufficient_resources");
    expect(mustPlayer(run(state, play(subject, fromHand(...paid))), P1).discard).toContain(subject);
  });

  it("an X event is not reduced whatever X is chosen: its printed cost is not a number", () => {
    const { state, subject, paid } = priced(withRule(), VARIABLE.id, 4);
    expect(matching(state, [subject], EXPENSIVE_EVENT)).toEqual([false]);
    expect(playCostOf(state, P1, subject, deps)).toMatchObject({ printed: 0, current: 0, contributions: [] });
    expect(refusal(state, play(subject, fromHand(...paid.slice(1)), 4))).toBe("insufficient_resources");
    expect(mustPlayer(run(state, play(subject, fromHand(...paid), 4)), P1).discard).toContain(subject);
  });

  it("a dash event is not reduced, and still cannot be played", () => {
    const { state, subject } = priced(withRule(), DASHED.id, 0);
    expect(matching(state, [subject], EXPENSIVE_EVENT)).toEqual([false]);
    expect(refusal(state, play(subject, []))).not.toBeNull();
  });
});
