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
import { stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
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

const deps: EngineDeps = depsOf(SYMBIOTE, HOLSTER);
const CARDS = [GUN, GADGET, SYMBIOTE_CARD, HOLSTER_CARD];

/** p1 with two restricted gadgets already in play, plus `extras` in play too. */
function start(extras: readonly CardId[]): GameState {
  let state = gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: [...copiesOf(GUN.id, 3), ...copiesOf(GADGET.id, 4), SYMBIOTE_CARD.id, HOLSTER_CARD.id],
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

describe("§3.22 a higher restricted limit", () => {
  it("with no rule, a third restricted card cannot be played", () => {
    expect(tryPlay(start([]), GUN.id).ok).toBe(false);
  });

  it("'1 additional upgrade that has the restricted keyword' allows a third, not a fourth", () => {
    const third = tryPlay(start([SYMBIOTE_CARD.id]), GADGET.id);
    expect(third.ok).toBe(true);
    expect(tryPlay(third.state, GUN.id).ok).toBe(false);
  });

  it("'1 additional [Weapon] upgrade …' allows a third only if it is a Weapon", () => {
    expect(tryPlay(start([HOLSTER_CARD.id]), GUN.id).ok).toBe(true);
    expect(tryPlay(start([HOLSTER_CARD.id]), GADGET.id).ok).toBe(false);
  });

  it("both together allow four when one of them is a Weapon", () => {
    const third = tryPlay(start([SYMBIOTE_CARD.id, HOLSTER_CARD.id]), GADGET.id);
    expect(third.ok).toBe(true);
    expect(tryPlay(third.state, GUN.id).ok).toBe(true);
    expect(tryPlay(third.state, GADGET.id).ok).toBe(false);
  });
});
