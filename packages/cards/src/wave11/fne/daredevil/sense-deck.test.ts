import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import { FNE_DAREDEVIL_SENSE_DECK as REGISTRY, FNE_DAREDEVIL_SENSE_DECK_SKIPPED as SKIPPED } from "./sense-deck.js";

/**
 * Wave 11 `fne/daredevil/sense-deck` (docs/phase7-wave11.md §8.4). Scaffold test: the module's script is checked in
 * isolation.
 * The scripting task adds the card scenarios here and names each registered ability id in this file (the wave's
 * coverage guard fails an id no test in the pack folder names).
 */
describe("wave 11 fne/daredevil/sense-deck", () => {
  it("registers only valid definitions", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
  });

  it("skips only refs it does not register, each with a written reason", () => {
    for (const [id, reason] of Object.entries(SKIPPED)) {
      expect(id in REGISTRY, id).toBe(false);
      expect(reason.length, id).toBeGreaterThan(20);
    }
  });
});
