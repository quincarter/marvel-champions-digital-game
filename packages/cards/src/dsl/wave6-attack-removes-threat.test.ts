/**
 * "That attack removes threat from the main scheme instead of dealing damage" (Determined Defense, `mut_gen` 32189).
 * `modifyAttack({ removesThreatFrom })` emits the `modifyAttack.removesThreatFrom` the engine reads at the attack's
 * damage step (`packages/engine/src/attack-removes-threat.test.ts` drives it).
 */

import { describe, expect, it } from "vitest";
import { heroInterrupt, on, spend } from "./abilities.js";
import { modifyAttack } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { theMainScheme, YOUR_IDENTITY } from "./values.js";

describe("`modifyAttack({ removesThreatFrom })`", () => {
  it("Determined Defense's shape: a '(defense/thwart)' interrupt to your defense, the removal a thwart", () => {
    const definition = heroInterrupt(
      on.defends(YOUR_IDENTITY),
      { label: ["defense", "thwart"], cost: spend(2) },
      modifyAttack({ removesThreatFrom: { scheme: theMainScheme, thwart: true } }),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.label).toEqual(["defense", "thwart"]);
    expect(definition.effects).toEqual([
      { kind: "modifyAttack", removesThreatFrom: { scheme: { kind: "mainScheme" }, thwart: true } },
    ]);
  });

  it("without `thwart` the removal is the card's own, and no `thwart` key is emitted", () => {
    expect(modifyAttack({ removesThreatFrom: { scheme: theMainScheme } })).toEqual({
      kind: "modifyAttack",
      removesThreatFrom: { scheme: { kind: "mainScheme" } },
    });
  });

  it("absent, no removesThreatFrom key is emitted", () => {
    expect(modifyAttack({ atkBonus: 1 })).not.toHaveProperty("removesThreatFrom");
  });
});
