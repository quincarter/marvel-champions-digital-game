/**
 * docs/phase7-wave6.md §3.41: `takeDamage` marks its damage `taken`, so no "that event deals N additional damage" bonus
 * adds to it (§4.1 Q21; the engine's `taken-damage-no-card-bonus.test.ts` drives it). `dealDamage` is unchanged.
 */

import { describe, expect, it } from "vitest";
import { dealDamage, takeDamage } from "./effects.js";
import { yourIdentity } from "./values.js";

describe("§3.41 `takeDamage` is `taken`", () => {
  it("'you take 2 damage': your identity, marked taken", () => {
    expect(takeDamage(2)).toEqual({
      kind: "dealDamage",
      target: { kind: "identityOf", player: { kind: "controller" } },
      amount: { kind: "const", value: 2 },
      taken: true,
    });
  });

  it("'deal 2 damage to your identity' is damage the card deals, not taken", () => {
    expect(dealDamage(2, yourIdentity)).not.toHaveProperty("taken");
  });
});
