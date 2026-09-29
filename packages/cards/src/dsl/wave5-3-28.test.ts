/**
 * docs/phase7-wave5.md §3.28: the DSL builder for "Until the end of the round, you may look at the top card of the
 * encounter deck at any time." (Sector Scan). It validates and emits exactly the plain data
 * `packages/engine/src/look-at-encounter-top.test.ts` drives.
 */

import { describe, expect, it } from "vitest";
import { action } from "./abilities.js";
import { mayLookAtTopOfEncounterDeckUntil } from "./effects.js";
import { validateDefinition } from "./validate.js";

describe("§3.28 looking at the top card of the encounter deck at any time", () => {
  it("Sector Scan: a lasting rule for the resolving player until the end of the round", () => {
    const definition = action(mayLookAtTopOfEncounterDeckUntil("endOfRound"));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      {
        kind: "applyRuleUntil",
        rule: { kind: "mayLookAtTopOfEncounterDeck", player: { kind: "controller" } },
        until: "endOfRound",
      },
    ]);
  });
});
