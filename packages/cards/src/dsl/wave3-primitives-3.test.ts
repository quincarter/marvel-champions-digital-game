/**
 * docs/phase7-wave3.md §3.48–§3.49: the DSL builders for the last three Market cards (`gmw` 16161, 16165, 16172). Each
 * composition validates and emits exactly the plain data the per-primitive engine test drives
 * (`packages/engine/src/place-top-or-bottom.test.ts`, `packages/engine/src/conditional-cost.test.ts`).
 */

import { describe, expect, it } from "vitest";
import {
  costIf,
  discardFromHandCost,
  discardTopOfDeckCost,
  eitherCost,
  exhaustThis,
  exhaustYourHero,
  heroAction,
  spend,
} from "./abilities.js";
import { cards, draw, encounterCards, placeOnTopOrBottom, selectCards } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, exists, perHero, query, varOf } from "./values.js";

const valid = (definition: Parameters<typeof validateDefinition>[0]) =>
  expect(validateDefinition(definition)).toEqual([]);
const MILANO = exists(query("support", { name: "Milano", controller: "you" }));

describe("§3.48 place each card on the top or the bottom", () => {
  it("placeOnTopOrBottom compiles to reorderCards to encounterDeckTopOrBottom, chosen by you", () => {
    const definition = heroAction(
      selectCards("looked", encounterCards(["deck"], undefined, perHero(2))),
      placeOnTopOrBottom(cards(chosen("looked"))),
      draw(1),
    );
    valid(definition);
    expect(definition.effects[1]).toEqual({
      kind: "reorderCards",
      cards: { kind: "ref", ref: { kind: "slot", slot: "looked" } },
      chooser: { kind: "controller" },
      to: "encounterDeckTopOrBottom",
    });
  });
});

describe("§3.49 a cost the board picks", () => {
  it("costIf compiles to AbilityCost.conditional beside the rest of the cost", () => {
    const definition = heroAction(
      { cost: [exhaustThis, costIf(MILANO, discardTopOfDeckCost(1), discardFromHandCost(1, 1))] },
      draw(1),
    );
    valid(definition);
    expect(definition.cost).toEqual({
      exhaustSelf: true,
      conditional: { condition: MILANO, then: { discardFromDeck: 1 }, else: { discardFromHand: { min: 1, max: 1 } } },
    });
  });

  it("a branch may be a merged list or an either/or, and binds what it pays plus cost.condition", () => {
    valid(
      heroAction(
        { cost: costIf(MILANO, [exhaustThis, discardTopOfDeckCost(1)], eitherCost(exhaustYourHero, spend(2))) },
        draw(varOf("cost.condition")),
      ),
    );
  });

  it("refuses a nested conditional and a branch that repeats the rest of the cost", () => {
    const nested = costIf(MILANO, costIf(MILANO, exhaustThis, spend(1)), spend(1));
    expect(validateDefinition(heroAction({ cost: nested }, draw(1)))).not.toEqual([]);
    const repeated = [exhaustThis, costIf(MILANO, exhaustThis, spend(1))];
    expect(validateDefinition(heroAction({ cost: repeated }, draw(1)))).not.toEqual([]);
    // Each branch is checked as the whole cost it makes.
    expect(
      validateDefinition(heroAction({ cost: costIf(MILANO, discardTopOfDeckCost(0), spend(1)) }, draw(1))),
    ).not.toEqual([]);
  });
});
