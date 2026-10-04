/**
 * docs/phase7-wave6.md §3.35: a scheme activation that removes threat instead of placing it. `modifyAttack({
 * removesThreat: true })` emits the `modifyAttack.removesThreat` the engine reads at the scheme's place-threat step
 * (`scheme-removes-threat.test.ts` drives it).
 */

import { describe, expect, it } from "vitest";
import { interrupt, on } from "./abilities.js";
import { modifyAttack } from "./effects.js";
import { validateDefinition } from "./validate.js";

describe("§3.35 `modifyAttack({ removesThreat: true })`", () => {
  it("Psychic Manipulation's shape: 'When the villain schemes, this activation removes threat instead'", () => {
    const definition = interrupt(on.enemySchemes({ categories: ["villain"] }), modifyAttack({ removesThreat: true }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([{ kind: "modifyAttack", removesThreat: true }]);
  });

  it("absent, no removesThreat key is emitted", () => {
    expect(modifyAttack({ threatBonus: -1 })).not.toHaveProperty("removesThreat");
  });
});
