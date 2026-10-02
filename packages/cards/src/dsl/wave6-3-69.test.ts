/**
 * docs/phase7-wave6.md §3.69: choosing a number, and spending different resources as an effect. The builders emit the
 * `chooseNumber` effect and the `spendResources.distinctTypes` field the engine resolves (`choose-number.test.ts` and
 * `spend-different-resources.test.ts` drive them).
 */

import { describe, expect, it } from "vitest";
import { whenRevealed } from "./abilities.js";
import {
  addCounters,
  chooseNumber,
  chooseOne,
  dealDamage,
  ifThen,
  option,
  spendDifferentResources,
  spendResources,
} from "./effects.js";
import { validateDefinition } from "./validate.js";
import { each, made, not, query, scaled, sum, thatPlayer, varOf, you, yourIdentity } from "./values.js";

const theChampion = each(query("environment"));

describe("§3.69 chooseNumber", () => {
  it("Break a Leg: the counters placed and the damage both read the number", () => {
    const placed = varOf("placed.amount");
    const definition = whenRevealed(
      chooseNumber("placed", 2),
      addCounters("ratings", placed, theChampion),
      dealDamage(sum(2, scaled(placed, { times: -1 })), yourIdentity),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects[0]).toEqual({
      kind: "chooseNumber",
      player: you,
      max: { kind: "const", value: 2 },
      bind: "placed",
    });
  });

  it("a live maximum, a minimum and another player", () => {
    expect(chooseNumber("x", varOf("damage"), { min: 1, player: thatPlayer })).toEqual({
      kind: "chooseNumber",
      player: thatPlayer,
      min: { kind: "const", value: 1 },
      max: { kind: "var", name: "damage" },
      bind: "x",
    });
  });

  it("the number cannot be read before it is chosen", () => {
    const early = whenRevealed(dealDamage(varOf("placed.amount"), yourIdentity), chooseNumber("placed", 2));
    expect(validateDefinition(early)).not.toEqual([]);
  });
});

describe("§3.69 spendResources with different types", () => {
  it("Director's Directions: 'Spend 2 different resources' as an option", () => {
    const definition = whenRevealed(
      chooseOne(
        option("Spend 2 different resources", spendDifferentResources(2, "spent")),
        option("Take 1 damage", dealDamage(1, yourIdentity)),
      ),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(spendDifferentResources(2, "spent")).toEqual({
      kind: "spendResources",
      player: you,
      resources: { generic: 2 },
      bind: "spent",
      distinctTypes: 2,
    });
  });

  it("`<bind>.made` gates what follows a spend that was not made", () => {
    const definition = whenRevealed(
      spendResources({ generic: 3 }, "spent", you, { distinctTypes: 2 }),
      ifThen(not(made("spent")), dealDamage(1, yourIdentity)),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects[0]).toMatchObject({ resources: { generic: 3 }, distinctTypes: 2 });
  });

  it("a plain spend carries no `distinctTypes` key", () => {
    expect(spendResources({ mental: 1 }, "spent")).toEqual({
      kind: "spendResources",
      player: you,
      resources: { mental: 1 },
      bind: "spent",
    });
  });
});
