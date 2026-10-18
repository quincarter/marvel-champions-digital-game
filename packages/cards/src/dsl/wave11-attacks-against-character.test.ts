/**
 * docs/phase7-wave11-hero-packs.md §H3.15: "Attacks against attached minion deal 2 additional damage and gain
 * overkill." (Cruisin' for a Bruisin' 62009), written with the two builders: `attacksGainKeywords(…, { target })` and
 * `attacksDealAdditionalDamage`. The engine's reading is proven in `packages/engine/src/attacks-against-character.test.ts`.
 */

import { describe, expect, it } from "vitest";
import { attacksDealAdditionalDamage, attacksGainKeywords, constant } from "./abilities.js";
import { validateDefinition } from "./validate.js";

const HOST = { hostOfSelf: true } as const;

describe("§H3.15 builders", () => {
  it("compile to an attackKeywords rule scoped by target and an attacksDealExtraDamage rule", () => {
    const definition = constant(
      attacksDealAdditionalDamage(2, { target: HOST }),
      attacksGainKeywords(["overkill"], { target: HOST }),
    );
    expect(definition.trigger).toMatchObject({
      kind: "constant",
      rules: [
        { kind: "attacksDealExtraDamage", amount: 2, target: HOST },
        { kind: "attackKeywords", keywords: ["overkill"], target: HOST },
      ],
    });
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("the control: no target, no attacker, no while unless given", () => {
    expect(attacksDealAdditionalDamage(1, { target: HOST }).rules).toEqual([
      { kind: "attacksDealExtraDamage", amount: 1, target: HOST },
    ]);
    expect(attacksGainKeywords(["ranged"]).rules).toEqual([{ kind: "attackKeywords", keywords: ["ranged"] }]);
  });
});
