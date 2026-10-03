/**
 * `canPayResources` / `canSpendDifferentResources`: the DSL wrappers of the engine's `canPayResources` predicate, which
 * gates a "Choose one" option on whether its spend could be paid (docs/phase7-wave6.md §3.69, pending default Q51).
 * The engine's `can-pay-resources.test.ts` drives the predicate itself.
 */
import { describe, expect, it } from "vitest";
import { whenRevealed } from "./abilities.js";
import { chooseOne, dealDamage, option, spendDifferentResources, spendResources } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { canPayResources, canSpendDifferentResources, thatPlayer, you, yourIdentity } from "./values.js";

describe("canPayResources", () => {
  it("emits the engine predicate for the choosing player, with the spend's own requirement", () => {
    expect(canPayResources({ energy: 1 })).toEqual({
      kind: "canPayResources",
      player: you,
      resources: { energy: 1 },
    });
    expect(canPayResources({ generic: 3 }, thatPlayer, { distinctTypes: 2 })).toEqual({
      kind: "canPayResources",
      player: thatPlayer,
      resources: { generic: 3 },
      distinctTypes: 2,
    });
  });

  it("canSpendDifferentResources(n) asks what spendDifferentResources(n, …) spends", () => {
    const spend = spendDifferentResources(2, "spent");
    expect(canSpendDifferentResources(2)).toEqual({
      kind: "canPayResources",
      player: you,
      resources: spend.kind === "spendResources" ? spend.resources : null,
      distinctTypes: 2,
    });
  });

  it("Director's Directions: the spend option is gated on it, and the definition validates", () => {
    const definition = whenRevealed(
      chooseOne(
        option(
          "Spend 2 different resources",
          { when: canSpendDifferentResources(2) },
          spendDifferentResources(2, "spent"),
        ),
        option("Take 1 damage", dealDamage(1, yourIdentity)),
      ),
    );
    expect(validateDefinition(definition)).toEqual([]);
    const [choose] = definition.effects;
    expect(choose?.kind === "chooseOne" ? choose.options[0]?.condition : null).toEqual({
      kind: "canPayResources",
      player: you,
      resources: { generic: 2 },
      distinctTypes: 2,
    });
  });

  it("a typed spend's option", () => {
    const gated = option("Spend an [energy] resource", { when: canPayResources({ energy: 1 }) }, [
      spendResources({ energy: 1 }, "spent"),
    ]);
    expect(gated.condition).toEqual({ kind: "canPayResources", player: you, resources: { energy: 1 } });
  });
});
