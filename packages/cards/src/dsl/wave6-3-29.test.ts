/**
 * docs/phase7-wave6.md §3.29: "this attack deals N additional damage" for a player attack in progress.
 * `modifyAttack({ extraDamage })` emits the `modifyAttack.extraDamage` the engine adds to the attack's damage
 * (`attack-extra-damage.test.ts` drives it).
 */

import { describe, expect, it } from "vitest";
import { heroInterrupt, on } from "./abilities.js";
import { modifyAttack } from "./effects.js";
import { YOUR_IDENTITY } from "./index.js";
import { validateDefinition } from "./validate.js";

describe("§3.29 `modifyAttack({ extraDamage })`", () => {
  it("Coup de Grâce's shape: 'When you attack, this attack deals 3 additional damage and gains overkill'", () => {
    const definition = heroInterrupt(on.attacks(YOUR_IDENTITY), modifyAttack({ extraDamage: 3, overkill: true }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      { kind: "modifyAttack", overkill: true, extraDamage: { kind: "const", value: 3 } },
    ]);
  });

  it("absent, no extraDamage key is emitted", () => {
    expect(modifyAttack({ overkill: true })).not.toHaveProperty("extraDamage");
  });
});
