/**
 * docs/phase7-wave9.md §3.46 (c): `spendableFromTucked`, "Any player may spend the resource card tucked here as if it
 * were in their hand" (Resource Reserve, `falcon` 53021). The engine's `spendable-from-tucked.test.ts` drives the
 * plain data.
 */

import { describe, expect, it } from "vitest";
import { action, constant, exhaustThis, spendableFromTucked } from "./abilities.js";
import { cards, chooseCards, tuckCards, zone } from "./effects.js";
import { chosen, query, self, tuckedCount, valueAtMost, you } from "./values.js";
import { validateDefinition } from "./validate.js";

describe("§3.46 (c) `spendableFromTucked`", () => {
  it("is a constant's rule: resource cards tucked here, for any player, unless it says otherwise", () => {
    const definition = constant(spendableFromTucked());
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "spendableFromTucked", cards: { categories: ["resource"] }, by: { kind: "each" } }],
    });
    expect(validateDefinition(definition)).toEqual([]);
    const mine = constant(spendableFromTucked({ by: you, cards: query("event") }));
    expect(mine.trigger).toMatchObject({
      rules: [{ kind: "spendableFromTucked", cards: { categories: ["event"] }, by: { kind: "controller" } }],
    });
    expect(validateDefinition(mine)).toEqual([]);
  });

  it("takes a condition", () => {
    const whileEmpty = valueAtMost(tuckedCount(self), 0);
    expect(constant(spendableFromTucked({ while: whileEmpty })).trigger).toMatchObject({
      rules: [{ kind: "spendableFromTucked", while: whileEmpty }],
    });
  });

  it("sits beside the action that tucks: exhaust this card, tuck 1 resource card from your hand, to a maximum of 1", () => {
    const definition = action(
      { cost: exhaustThis, while: valueAtMost(tuckedCount(self), 0) },
      chooseCards("tucked", zone("hand", you, { filter: query("resource") }), { min: 1, max: 1 }),
      tuckCards(cards(chosen("tucked")), self),
    );
    expect(definition).toMatchObject({ trigger: { kind: "action" }, cost: { exhaustSelf: true } });
    expect(validateDefinition(definition)).toEqual([]);
  });
});
