/**
 * docs/phase7-wave9.md §3.37: a card searched for in the deck and played at a reduced cost. `playFromDeckReducingCost`
 * emits the `playFromHand { from: "deck", costReduction }` the engine resolves (`play-from-deck.test.ts` drives it).
 */

import { trait } from "@mc/content";
import type { AbilityDefinition } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { alterEgoAction, exhaustThis, oncePerRound } from "./abilities.js";
import { playFromDeckIgnoringCost, playFromDeckReducingCost } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { query, thatPlayer } from "./values.js";

const UPGRADES = query("upgrade", { anyTrait: [trait("BLACK PANTHER"), trait("TECH")] });

describe("§3.37 `playFromDeckReducingCost`", () => {
  it("Inventor's shape: a required play from the searched deck, the reduction a constant", () => {
    const effect = playFromDeckReducingCost(2, undefined, { filter: UPGRADES });
    expect(effect).toEqual({
      kind: "playFromHand",
      player: { kind: "controller" },
      from: "deck",
      costReduction: { kind: "const", value: 2 },
      filter: UPGRADES,
    });
    const inventor = alterEgoAction({ cost: exhaustThis, limit: oncePerRound }, effect);
    expect(validateDefinition(inventor)).toEqual([]);
  });

  it("`optional` makes it 'you may'; the player is carried through", () => {
    expect(playFromDeckReducingCost(1, thatPlayer, { optional: true })).toEqual({
      kind: "playFromHand",
      player: { kind: "scoped" },
      from: "deck",
      costReduction: { kind: "const", value: 1 },
      optional: true,
    });
  });

  const withEffect = (effect: object): AbilityDefinition =>
    ({ trigger: { kind: "action" }, effects: [effect] }) as AbilityDefinition;

  it("the validator refuses a play whose cost is both ignored and reduced", () => {
    const both = { ...playFromDeckIgnoringCost(), costReduction: { kind: "const", value: 2 } };
    expect(validateDefinition(withEffect(both))).toEqual(["playFromHand: the cost is ignored or reduced, not both"]);
  });

  it("the validator refuses a negative or fractional constant reduction, and a deck play that names its card", () => {
    expect(validateDefinition(withEffect(playFromDeckReducingCost(-1)))).toEqual([
      "playFromHand costReduction: a constant reduction must be a whole number of at least 0",
    ]);
    expect(validateDefinition(withEffect(playFromDeckReducingCost(1.5)))).toEqual([
      "playFromHand costReduction: a constant reduction must be a whole number of at least 0",
    ]);
    expect(validateDefinition(withEffect({ ...playFromDeckReducingCost(2), card: { kind: "self" } }))).toEqual([
      "playFromHand from deck: the card is picked from the searched deck, so `card` is not read",
    ]);
  });
});
