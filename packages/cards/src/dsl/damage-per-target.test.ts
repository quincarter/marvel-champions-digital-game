/**
 * `dealDamage` `perTarget`, `removeEachCounterFrom` `bind` and `varFor`: "remove all bomb counters from play and deal 2
 * damage to each enemy for each bomb counter removed from it this way" (Boom Boom, `mut_gen` 32090). The engine's
 * `damage-per-target.test.ts` drives them. Shapes and validation only.
 */

import { describe, expect, it } from "vitest";
import { action } from "./abilities.js";
import { dealDamage, removeEachCounterFrom } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, each, query, scaled, varFor } from "./values.js";

const bombed = each(query([], { hasCounter: "bomb" }));

describe("a per-target damage amount", () => {
  it("removeEachCounterFrom: every counter of the type (no amount), with the bind that records each card's count", () => {
    expect(removeEachCounterFrom(bombed, "bomb", { bind: "removed" })).toEqual({
      kind: "removeCounters",
      target: { kind: "each", query: { hasCounter: "bomb" } },
      counterType: "bomb",
      bind: "removed",
    });
    expect(removeEachCounterFrom(bombed, "bomb")).toEqual({
      kind: "removeCounters",
      target: bombed,
      counterType: "bomb",
    });
  });

  it("varFor reads a card's own number; dealDamage perTarget marks the amount as read per target", () => {
    expect(varFor("removed.amount", chosen("affected"))).toEqual({
      kind: "var",
      name: "removed.amount",
      of: { kind: "slot", slot: "affected" },
    });
    expect(dealDamage(1, each(query("enemy")), { perTarget: true })).toMatchObject({ perTarget: true });
    expect(dealDamage(1, each(query("enemy")))).not.toHaveProperty("perTarget");
  });

  it("Boom Boom's shape validates: the affected slot is bound inside a per-target amount, the var by the removal", () => {
    const definition = action(
      removeEachCounterFrom(bombed, "bomb", { bind: "removed" }),
      dealDamage(scaled(varFor("removed.amount", chosen("affected")), { times: 2 }), each(query("enemy")), {
        perTarget: true,
      }),
    );
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("validation: the affected slot is unbound without perTarget, and the var without the removal's bind", () => {
    const amount = scaled(varFor("removed.amount", chosen("affected")), { times: 2 });
    const flat = action(
      removeEachCounterFrom(bombed, "bomb", { bind: "removed" }),
      dealDamage(amount, each(query("enemy"))),
    );
    expect(validateDefinition(flat)).toContain('effects[1] dealDamage: slot "affected" is read before it is bound');
    const unbound = action(
      removeEachCounterFrom(bombed, "bomb"),
      dealDamage(amount, each(query("enemy")), { perTarget: true }),
    );
    expect(validateDefinition(unbound)).toContain(
      'effects[1] dealDamage: var "removed.amount" is read before it is bound',
    );
  });
});
