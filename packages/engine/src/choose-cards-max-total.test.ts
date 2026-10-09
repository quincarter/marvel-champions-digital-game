/**
 * docs/phase7-wave9.md §3.11: `EffectSpec chooseCards.maxTotal { of: "printedCost", atMost }`: "any number of
 * [AGENCY] supports with a combined printed cost of 6 or less". Proven with synthetic supports costed like the cards
 * that print it (6, 1, 2, 3) and an action that puts a counter on each card chosen.
 *
 * Sources: RRG 1.8 "Printed" (p. 35): "the text, characteristic, or value that is physically printed on the card";
 * "Cost" (p. 13): "A card's resource cost is the numerical value that must be paid to play the card"; "Dash (Value)"
 * (p. 15): "If a game step or card ability references a value of dash (–), that value is treated as an unmodifiable
 * 0"; "Non-Numerical Variable" (p. 30): "If the variable is not defined … treat that variable as being equal to 0",
 * which is a printed X on a card nobody is playing.
 */

import { trait, type SupportCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import { cardTotalFault, cardTotalOf, mostCardsUnderTotal } from "./choices.js";
import type { Command } from "./commands.js";
import { replay, sessionApply, startSession, type GameSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const AGENCY = trait("AGENCY");
const agency = (id: string, cost: number, specialCost?: "X" | "dash"): SupportCard => ({
  ...stubSupport({ id, cost, traits: [AGENCY] }),
  ...(specialCost ? { specialCost } : {}),
});
const ILIAD = agency("iliad", 6);
const STAFF = agency("staff", 1);
const TEAM = agency("team", 2);
const DESTROYER = agency("destroyer", 3);
/** Printed cost 7: over the limit on its own, so never offered. */
const CARRIER = agency("carrier", 7);
/** A printed "—" cost and a printed X cost: both count 0. */
const DASHED = agency("dashed", 0, "dash");
const VARIABLE = agency("variable", 0, "X");
/** Another player's kind of support: no trait, never a candidate. */
const OUTSIDER = stubSupport({ id: "outsider", cost: 1 });

const choose = (min: number, atMost: number): EffectSpec => ({
  kind: "chooseCards",
  slot: "picked",
  from: { kind: "ref", ref: { kind: "each", query: { categories: ["support"], trait: AGENCY } } },
  chooser: { kind: "controller" },
  min,
  max: 99,
  maxTotal: { of: "printedCost", atMost },
});
const mark: EffectSpec = {
  kind: "addCounters",
  target: { kind: "slot", slot: "picked" },
  counterType: "all-purpose",
  amount: { kind: "const", value: 1 },
};
const action = (id: string, min: number, atMost = 6) =>
  stubAbility(id, def({ trigger: { kind: "action" }, effects: [choose(min, atMost), mark] }));
/** "Choose any number of AGENCY supports with a combined printed cost of 6 or less. Place 1 counter on each." */
const ANY = action("caller.any", 0);
/** The same, choosing at least two (no printed card does; the engine honors the minimum as written). */
const TWO = action("caller.two", 2);
/** A limit of 0: only the cards that count 0 can be chosen. */
const FREE = action("caller.free", 0, 0);
const CALLER = stubSupport({ id: "caller", cost: 0, abilities: [ANY.ref, TWO.ref, FREE.ref] });
const deps = depsOf(ANY, TWO, FREE);

const ALL = [ILIAD, STAFF, TEAM, DESTROYER, CARRIER, DASHED, VARIABLE, OUTSIDER];

/** p1 with the caller and `inPlay` in play (in that order), then the action used: the choice is open. */
function open(inPlay: readonly SupportCard[], ability = ANY) {
  let state: GameState = gameAtFirstTurn({
    cards: [CALLER, ...ALL],
    deps,
    deck: [CALLER.id, ...ALL.map((card) => card.id)],
  });
  const caller = playerCardIntoPlay(state, CALLER.id);
  state = caller.state;
  const ids: Record<string, InstanceId> = {};
  for (const card of inPlay) {
    const put = playerCardIntoPlay(state, card.id);
    state = put.state;
    ids[card.id] = put.id;
  }
  const used = sessionApply(
    startSession(state),
    { type: "useAbility", playerId: P1, cardInstanceId: caller.id, abilityId: ability.ref.id, payment: [] },
    deps,
  );
  if (!used.ok) throw new Error(used.error.message);
  return { session: used.session, ids, id: (card: SupportCard): InstanceId => ids[card.id]! };
}

const answer = (session: GameSession, selected: readonly InstanceId[] | readonly string[]) => {
  const choice = session.state.pendingChoice;
  if (!choice) throw new Error("no choice is open");
  const command: Command = {
    type: "resolveChoice",
    playerId: P1,
    choiceId: choice.choiceId,
    selectedOptionIds: [...selected],
  };
  return sessionApply(session, command, deps);
};
const counters = (state: GameState, id: InstanceId): number => mustInstance(state, id).counters["all-purpose"] ?? 0;
const marked = (state: GameState, ids: Readonly<Record<string, InstanceId>>): readonly string[] =>
  Object.entries(ids)
    .filter(([, id]) => counters(state, id) === 1)
    .map(([card]) => card)
    .sort();

describe("§3.11 `chooseCards.maxTotal`: cards chosen up to a combined printed cost", () => {
  it("the choice carries the limit and each card's printed cost; a card over the limit alone is not offered", () => {
    const t = open([ILIAD, STAFF, TEAM, DESTROYER, CARRIER, OUTSIDER]);
    const choice = t.session.state.pendingChoice!;
    expect(choice.prompt).toEqual({
      kind: "chooseCards",
      slot: "picked",
      maxTotal: {
        of: "printedCost",
        atMost: 6,
        values: { [t.id(ILIAD)]: 6, [t.id(STAFF)]: 1, [t.id(TEAM)]: 2, [t.id(DESTROYER)]: 3 },
      },
    });
    expect(choice.options.map((o) => o.optionId)).toEqual([t.id(ILIAD), t.id(STAFF), t.id(TEAM), t.id(DESTROYER)]);
    // "Any number": none is allowed, and at most the three that fit together (1 + 2 + 3).
    expect([choice.minSelections, choice.maxSelections]).toEqual([0, 3]);
  });

  it("1 + 2 + 3 is exactly 6: allowed, and each gets its counter", () => {
    const t = open([ILIAD, STAFF, TEAM, DESTROYER]);
    const result = answer(t.session, [t.id(STAFF), t.id(TEAM), t.id(DESTROYER)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.session.state.pendingChoice).toBeNull();
    expect(marked(result.session.state, t.ids)).toEqual(["destroyer", "staff", "team"]);
    const replayed = replay(result.session.log, deps);
    expect(replayed.ok && replayed.state).toEqual(result.session.state);
  });

  it("the 6-cost card alone is exactly 6: allowed", () => {
    const t = open([ILIAD, STAFF, TEAM, DESTROYER]);
    const result = answer(t.session, [t.id(ILIAD)]);
    expect(result.ok && marked(result.session.state, t.ids)).toEqual(["iliad"]);
  });

  it("6 + 1 is one over: refused, the choice stays open and nothing changed", () => {
    const t = open([ILIAD, STAFF, TEAM, DESTROYER]);
    const result = answer(t.session, [t.id(ILIAD), t.id(STAFF)]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_choice");
    expect(result.error.message).toBe("the cards chosen have a combined printed cost of 7; the most allowed is 6");
    expect(t.session.state.pendingChoice?.prompt.kind).toBe("chooseCards");
    expect(marked(t.session.state, t.ids)).toEqual([]);
    // The same choice then takes a selection that fits.
    expect(answer(t.session, [t.id(TEAM), t.id(DESTROYER)]).ok).toBe(true);
  });

  it("2 + 3 + 6 is refused though three cards may be chosen: the count is not the limit", () => {
    const t = open([ILIAD, STAFF, TEAM, DESTROYER]);
    expect(answer(t.session, [t.id(TEAM), t.id(DESTROYER), t.id(ILIAD)]).ok).toBe(false);
  });

  it("a printed '—' cost and a printed X cost count 0: both fit beside the 6-cost card", () => {
    const t = open([ILIAD, DASHED, VARIABLE, STAFF]);
    const choice = t.session.state.pendingChoice!;
    expect(choice.prompt).toMatchObject({
      maxTotal: { values: { [t.id(ILIAD)]: 6, [t.id(DASHED)]: 0, [t.id(VARIABLE)]: 0, [t.id(STAFF)]: 1 } },
    });
    expect(choice.maxSelections).toBe(3);
    const result = answer(t.session, [t.id(DASHED), t.id(VARIABLE), t.id(ILIAD)]);
    expect(result.ok && marked(result.session.state, t.ids)).toEqual(["dashed", "iliad", "variable"]);
    expect(answer(t.session, [t.id(DASHED), t.id(ILIAD), t.id(STAFF)]).ok).toBe(false);
  });

  it("a limit of 0 offers only the cards that count 0", () => {
    const t = open([ILIAD, DASHED, STAFF, VARIABLE], FREE);
    const choice = t.session.state.pendingChoice!;
    expect(choice.options.map((o) => o.optionId)).toEqual([t.id(DASHED), t.id(VARIABLE)]);
    expect(choice.maxSelections).toBe(2);
  });

  it("nothing fits: no choice is asked and nothing is chosen", () => {
    const t = open([CARRIER, OUTSIDER]);
    expect(t.session.state.pendingChoice).toBeNull();
    expect(marked(t.session.state, t.ids)).toEqual([]);
  });

  it("legalActions reports the open choice, and the default pick for 'any number' is none", () => {
    const t = open([ILIAD, STAFF, TEAM, DESTROYER]);
    const legal = legalActions(t.session.state, P1, deps);
    expect(legal.kind).toBe("choice");
    if (legal.kind !== "choice") return;
    expect(legal.choice.prompt).toMatchObject({ kind: "chooseCards", maxTotal: { of: "printedCost", atMost: 6 } });
    expect(defaultPick(t.session.state)).toEqual([]);
    const result = answer(t.session, defaultPick(t.session.state));
    expect(result.ok && marked(result.session.state, t.ids)).toEqual([]);
  });

  it("with a minimum, the default pick is the cheapest cards, which always fit: not the first two offered", () => {
    const t = open([ILIAD, DESTROYER, TEAM, STAFF], TWO);
    const choice = t.session.state.pendingChoice!;
    expect([choice.minSelections, choice.maxSelections]).toEqual([2, 3]);
    // The first two offered are 6 + 3; the default takes 1 + 2.
    expect(choice.options.slice(0, 2).map((o) => o.optionId)).toEqual([t.id(ILIAD), t.id(DESTROYER)]);
    expect(defaultPick(t.session.state)).toEqual([t.id(STAFF), t.id(TEAM)]);
    const result = answer(t.session, defaultPick(t.session.state));
    expect(result.ok && marked(result.session.state, t.ids)).toEqual(["staff", "team"]);
    expect(answer(t.session, [t.id(STAFF)]).ok).toBe(false);
  });

  it("a minimum no two cards can meet is lowered to what fits", () => {
    const t = open([ILIAD, CARRIER], TWO);
    const choice = t.session.state.pendingChoice!;
    expect([choice.minSelections, choice.maxSelections]).toEqual([1, 1]);
    expect(choice.options.map((o) => o.optionId)).toEqual([t.id(ILIAD)]);
  });

  it("the helpers a client reads: the running total, the fault, and how many fit", () => {
    const limit = { of: "printedCost", atMost: 6, values: { a: 6, b: 1, c: 2, d: 3 } } as const;
    expect(cardTotalOf(limit, ["b", "c", "d"])).toBe(6);
    expect(cardTotalFault(limit, ["b", "c", "d"])).toBeNull();
    expect(cardTotalFault(limit, ["a", "b"])).toMatch(/combined printed cost of 7/);
    expect(mostCardsUnderTotal([6, 1, 2, 3], 6)).toBe(3);
    expect(mostCardsUnderTotal([6, 0, 0], 6)).toBe(3);
    expect(mostCardsUnderTotal([7], 6)).toBe(0);
  });
});
