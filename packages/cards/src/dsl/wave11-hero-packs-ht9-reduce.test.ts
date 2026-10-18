/**
 * docs/phase7-wave11-hero-packs.md: HT9 (§H3.14) `basicPowerBy` / `canUseBasicPower` terms, and a live amount for
 * `reducesAttackDamageTaken` (Echo 61038, H7). The engine drives them: `basic-power-terms.test.ts`,
 * `reduce-damage-live-amount.test.ts`.
 */

import { describe, expect, it } from "vitest";
import { action, constant, reducesAttackDamageTaken } from "./abilities.js";
import { basicPowerBy } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { canUseBasicPower, statOf, you, yourIdentity } from "./values.js";

describe("HT9 basicPowerBy terms (Grapnel Launcher 61023)", () => {
  it("'your hero', 'without exhausting', 'ignores patrol and crisis' are carried on the effect and the gate", () => {
    const terms = { character: "identity", withoutExhausting: true, ignores: ["patrol", "crisis"] } as const;
    const definition = action(
      { while: canUseBasicPower(["thwart"], you, terms) },
      basicPowerBy(you, ["thwart"], { bonus: { thw: 1 }, terms }),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "action",
      while: { kind: "canUseBasicPower", player: { kind: "controller" }, powers: ["thwart"], terms },
    });
    expect(definition.effects).toEqual([
      { kind: "basicPowerBy", player: { kind: "controller" }, powers: ["thwart"], bonus: { thw: 1 }, terms },
    ]);
  });

  it("control: without terms neither spec carries any; ignores on an attack-only power are refused", () => {
    expect(basicPowerBy(you, ["attack"])).toEqual({
      kind: "basicPowerBy",
      player: { kind: "controller" },
      powers: ["attack"],
    });
    expect(canUseBasicPower(["attack"])).toEqual({
      kind: "canUseBasicPower",
      player: { kind: "controller" },
      powers: ["attack"],
    });
    expect(() => basicPowerBy(you, ["attack"], { terms: { ignores: ["crisis"] } })).toThrow();
  });
});

describe("reducesAttackDamageTaken by a live amount (Echo 61038)", () => {
  it("'by your hero's DEF' is a stat value; a literal amount is unchanged", () => {
    const echo = constant(reducesAttackDamageTaken({ self: true }, statOf(yourIdentity, "def")));
    expect(validateDefinition(echo)).toEqual([]);
    expect(echo.trigger).toMatchObject({
      rules: [
        {
          kind: "reduceDamageTaken",
          target: { self: true },
          amount: { kind: "stat", of: yourIdentity, stat: "def" },
          fromAttack: true,
        },
      ],
    });
    expect(constant(reducesAttackDamageTaken({ self: true }, 1)).trigger).toMatchObject({
      rules: [{ kind: "reduceDamageTaken", amount: 1, fromAttack: true }],
    });
  });
});
