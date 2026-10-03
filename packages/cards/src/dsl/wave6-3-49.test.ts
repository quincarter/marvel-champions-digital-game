/**
 * docs/phase7-wave6.md §3.49: the DSL side of attaching a card as a cost and dealing damage as a cost ("Hero Action:
 * Find Touched and attach it to a character other than Rogue and deal 2 damage to that character → heal 2 damage from
 * Rogue and ready her", Energy Transfer, `rogue` 38007, erratum RRG 1.8 p. 69). `attachCost` compiles to the engine's
 * `AbilityCost.attach`, `dealDamageCost` to `AbilityCost.dealDamage`; the engine's `attach-any-character.test.ts`
 * drives the behaviour. Shapes only (Rogue's own cards are scripted elsewhere, against their regenerated data).
 */

import type { AbilityCost } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { attachCost, dealDamageCost, heroAction } from "./abilities.js";
import { addCounters, heal, ready } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, find, identityOf, query, yourIdentity, you } from "./values.js";

const TOUCHED = query("upgrade", { name: "Touched" });
const OTHER_CHARACTER = query("character", { excluding: yourIdentity });

describe("§3.49 attachCost / dealDamageCost", () => {
  it("compile to the engine's cost components", () => {
    expect(attachCost(find(TOUCHED, { owner: you }), OTHER_CHARACTER, "host")).toEqual({
      attach: {
        card: { kind: "find", query: { categories: ["upgrade"], name: "Touched" }, owner: { kind: "controller" } },
        to: { slot: "host", query: { categories: ["character"], excluding: identityOf(you) } },
      },
    });
    expect(attachCost(find(TOUCHED), OTHER_CHARACTER, "host", { bind: "touched" }).attach?.bind).toBe("touched");
    expect(dealDamageCost(chosen("host"), 2)).toEqual({
      dealDamage: { target: { kind: "slot", slot: "host" }, amount: 2 },
    });
  });

  it("Energy Transfer's shape validates, and its effects may read the host and the attached card", () => {
    const definition = heroAction(
      {
        cost: [
          attachCost(find(TOUCHED, { owner: you }), OTHER_CHARACTER, "host", { bind: "touched" }),
          dealDamageCost(chosen("host"), 2),
        ],
      },
      heal(2, yourIdentity),
      ready(yourIdentity),
      addCounters("marker", 1, chosen("host")),
      addCounters("marker", 1, chosen("touched")),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.cost).toEqual({
      attach: {
        card: { kind: "find", query: { categories: ["upgrade"], name: "Touched" }, owner: { kind: "controller" } },
        to: { slot: "host", query: { categories: ["character"], excluding: identityOf(you) } },
        bind: "touched",
      },
      dealDamage: { target: { kind: "slot", slot: "host" }, amount: 2 },
    });
  });

  it("near miss: an effect reading a slot the cost does not bind is refused", () => {
    const definition = heroAction(
      { cost: attachCost(find(TOUCHED, { owner: you }), OTHER_CHARACTER, "host") },
      addCounters("marker", 1, chosen("touched")),
    );
    expect(validateDefinition(definition).join(" ")).toContain("touched");
  });

  it("refuses an empty host slot, a slot shared with another pick, and damage below 1 or fractional", () => {
    const shaped = (cost: AbilityCost) => validateDefinition(heroAction({ cost }, ready(yourIdentity)));
    expect(shaped(attachCost(find(TOUCHED), OTHER_CHARACTER, ""))).toContain("cost attach: needs a slot for the host");
    expect(shaped(attachCost(find(TOUCHED), OTHER_CHARACTER, "host", { bind: "host" })).join(" ")).toContain(
      "same slot",
    );
    const damage = "cost dealDamage: amount must be a whole number of at least 1";
    expect(shaped(dealDamageCost(yourIdentity, 0))).toContain(damage);
    expect(shaped(dealDamageCost(yourIdentity, 1.5))).toContain(damage);
    expect(shaped(dealDamageCost(yourIdentity, 1))).toEqual([]);
  });
});
