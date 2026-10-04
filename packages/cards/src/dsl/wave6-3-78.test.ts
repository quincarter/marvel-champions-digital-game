/**
 * docs/phase7-wave6.md §3.78: `statusCount` (how many status cards of a type are on a card) and `generatesAmount` (a
 * resource ability generating a number read from the table). The engine reads them in
 * `engine/src/status-count-generation.test.ts`. Shapes only (Titanium Muscles, `mut_gen` 32005, is scripted in
 * `wave6/mut_gen/colossus/`).
 */

import { describe, expect, it } from "vitest";
import { exhaustThis, generatesAmount, heroResource, resource } from "./abilities.js";
import { validateDefinition } from "./validate.js";
import { countersOn, self, statusCount, theVillain } from "./values.js";

describe("§3.78 `statusCount` and `generatesAmount`", () => {
  it("Titanium Muscles: Hero Resource, exhaust → a [physical] resource for each tough status card on Colossus", () => {
    const definition = heroResource(generatesAmount("physical", statusCount("tough")), { cost: exhaustThis });
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition).toEqual({
      trigger: { kind: "resource", form: "hero" },
      cost: { exhaustSelf: true },
      effects: [],
      generates: {
        kind: "amount",
        resource: "physical",
        amount: { kind: "statusCount", of: { kind: "identityOf", player: { kind: "controller" } }, status: "tough" },
      },
    });
  });

  it("`statusCount` defaults to your identity and takes another card and status", () => {
    expect(statusCount("tough")).toEqual({
      kind: "statusCount",
      of: { kind: "identityOf", player: { kind: "controller" } },
      status: "tough",
    });
    expect(statusCount("stunned", theVillain)).toEqual({
      kind: "statusCount",
      of: { kind: "villain" },
      status: "stunned",
    });
  });

  it("`generatesAmount` takes a number, any value, and a maximum", () => {
    expect(generatesAmount("wild", 2)).toEqual({
      kind: "amount",
      resource: "wild",
      amount: { kind: "const", value: 2 },
    });
    const capped = resource(generatesAmount("energy", countersOn(self, "charge"), 3));
    expect(validateDefinition(capped)).toEqual([]);
    expect(capped.generates).toEqual({
      kind: "amount",
      resource: "energy",
      amount: { kind: "counters", of: { kind: "self" }, counterType: "charge" },
      max: 3,
    });
  });
});
