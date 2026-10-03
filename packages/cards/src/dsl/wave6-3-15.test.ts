/**
 * docs/phase7-wave6.md §3.15: withholding the boost card from the activation in progress. `modifyAttack({ noBoost:
 * true })` emits the `modifyAttack.noBoost` the engine reads at the `giveBoost` stage (`no-boost-activation.test.ts`
 * drives it).
 */

import { describe, expect, it } from "vitest";
import { forcedInterrupt, on } from "./abilities.js";
import { modifyAttack } from "./effects.js";
import { validateDefinition } from "./validate.js";

describe("§3.15 `modifyAttack({ noBoost: true })`", () => {
  it("Master Mold's shape: 'When Master Mold schemes against you … Do not give Master Mold a boost card'", () => {
    const definition = forcedInterrupt(on.enemySchemes("self"), modifyAttack({ noBoost: true }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([{ kind: "modifyAttack", noBoost: true }]);
  });

  it("absent, no noBoost key is emitted", () => {
    expect(modifyAttack({ extraBoostCards: 1 })).not.toHaveProperty("noBoost");
  });
});
