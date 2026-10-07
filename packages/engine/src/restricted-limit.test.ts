/**
 * docs/phase7-wave3.md §3.22: `RuleSpec restrictedLimit`. Synthetic cards shaped like Venom / Flash Thompson (`vnm`
 * 20001a/b: "You can control 1 additional upgrade that has the restricted keyword.") and Side Holster (20021: "You can
 * control 1 additional [Weapon] upgrade that has the restricted keyword.").
 *
 * Sources: RRG 1.8 "Restricted" (p. 38).
 */

import { trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, RuleSpec } from "./abilities.js";
import { applyCommand } from "./engine.js";
import type { InstanceId } from "./ids.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { restrictedCardsOf } from "./select.js";
import { stubEvent, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { giveCard, resolvePending } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const WEAPON = trait("Weapon");
const restricted = [{ name: "restricted" as const }];
const GUN = stubUpgrade({ id: "gun", cost: 0, traits: [WEAPON], keywords: restricted });
const GADGET = stubUpgrade({ id: "gadget", cost: 0, keywords: restricted });

const constant = (id: string, rules: readonly RuleSpec[]) => {
  const definition: AbilityDefinition = { trigger: { kind: "constant", rules }, effects: [] };
  return stubAbility(id, definition);
};
const SYMBIOTE = constant("symbiote.constant", [{ kind: "restrictedLimit", amount: 1 }]);
const HOLSTER = constant("holster.constant", [{ kind: "restrictedLimit", amount: 1, cards: { trait: WEAPON } }]);
const SYMBIOTE_CARD = stubSupport({ id: "symbiote", cost: 0, abilities: [SYMBIOTE.ref] });
const HOLSTER_CARD = stubSupport({ id: "holster", cost: 0, abilities: [HOLSTER.ref] });

/** "Discard the Symbiote from play." */
const SCRAP_ABILITY = stubAbility("scrap.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "discardFromPlay", target: { kind: "each", query: { name: SYMBIOTE_CARD.name } } }],
});
const SCRAP = { card: stubEvent({ id: "scrap", cost: 0, abilities: [SCRAP_ABILITY.ref] }) };

const deps: EngineDeps = depsOf(SYMBIOTE, HOLSTER, SCRAP_ABILITY);
const CARDS = [GUN, GADGET, SYMBIOTE_CARD, HOLSTER_CARD, SCRAP.card];

/** p1 with two restricted gadgets already in play, plus `extras` in play too. */
function start(extras: readonly CardId[]): GameState {
  let state = gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: [...copiesOf(GUN.id, 3), ...copiesOf(GADGET.id, 4), SYMBIOTE_CARD.id, HOLSTER_CARD.id, SCRAP.card.id],
  });
  for (const card of [GADGET.id, GADGET.id, ...extras]) state = playerCardIntoPlay(state, card).state;
  return state;
}
function tryPlay(state: GameState, card: string): { ok: boolean; state: GameState; id: InstanceId } {
  const given = giveCard(state, P1, card);
  const result = applyCommand(
    given.state,
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
    deps,
  );
  return { ok: result.ok, state: result.ok ? result.state : given.state, id: given.id };
}
/** How many restricted cards the play left p1 to discard: 0 when it fit under the limit. */
function overAfter(played: { ok: boolean; state: GameState }): number {
  expect(played.ok).toBe(true);
  const choice = played.state.pendingChoice;
  if (choice?.prompt.kind !== "discardRestricted") return 0;
  expect(choice.maxSelections).toBe(choice.minSelections);
  return choice.minSelections;
}

// RRG 1.8 "Restricted" (p. 38): the play is always legal; over the limit, the player discards down to it.
describe("§3.22 a higher restricted limit", () => {
  it("with no rule, a third restricted card is played and one must be discarded, down to two", () => {
    const third = tryPlay(start([]), GUN.id);
    expect(overAfter(third)).toBe(1);
    expect(third.state.pendingChoice?.prompt).toEqual({ kind: "discardRestricted", limit: 2 });
  });

  it("'1 additional upgrade that has the restricted keyword' fits a third, not a fourth", () => {
    const third = tryPlay(start([SYMBIOTE_CARD.id]), GADGET.id);
    expect(overAfter(third)).toBe(0);
    const fourth = tryPlay(third.state, GUN.id);
    expect(overAfter(fourth)).toBe(1);
    expect(fourth.state.pendingChoice?.prompt).toEqual({ kind: "discardRestricted", limit: 3 });
  });

  it("'1 additional [Weapon] upgrade …' fits a third only if it is a Weapon", () => {
    expect(overAfter(tryPlay(start([HOLSTER_CARD.id]), GUN.id))).toBe(0);
    const gadget = tryPlay(start([HOLSTER_CARD.id]), GADGET.id);
    expect(overAfter(gadget)).toBe(1);
    expect(gadget.state.pendingChoice?.prompt).toEqual({ kind: "discardRestricted", limit: 2 });
  });

  it("both together fit four when one of them is a Weapon", () => {
    const third = tryPlay(start([SYMBIOTE_CARD.id, HOLSTER_CARD.id]), GADGET.id);
    expect(overAfter(third)).toBe(0);
    expect(overAfter(tryPlay(third.state, GUN.id))).toBe(0);
    const gadget = tryPlay(third.state, GADGET.id);
    expect(overAfter(gadget)).toBe(1);
    expect(gadget.state.pendingChoice?.prompt).toEqual({ kind: "discardRestricted", limit: 3 });
  });

  it("a card that raised the limit leaving play puts its controller over: they discard down at once", () => {
    const third = tryPlay(start([SYMBIOTE_CARD.id]), GADGET.id);
    expect(overAfter(third)).toBe(0);
    const restrictedInPlay = restrictedCardsOf(third.state, P1, deps);
    expect(restrictedInPlay).toHaveLength(3);
    const scrapped = tryPlay(third.state, SCRAP.card.id);
    const choice = scrapped.state.pendingChoice;
    expect(choice?.prompt).toEqual({ kind: "discardRestricted", limit: 2 });
    expect(choice?.options.map((option) => option.optionId)).toEqual(restrictedInPlay);
    expect([choice?.minSelections, choice?.maxSelections]).toEqual([1, 1]);
    const after = resolvePending(scrapped.state, [restrictedInPlay[1] as string], deps);
    expect(restrictedCardsOf(after, P1, deps)).toEqual([restrictedInPlay[0], restrictedInPlay[2]]);
    expect(after.pendingChoice).toBeNull();
  });
});
