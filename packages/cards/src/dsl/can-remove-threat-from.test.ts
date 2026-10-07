/**
 * `canRemoveThreatFrom`: the DSL wrapper of the engine predicate of the same name, which gates an ability on whether
 * its card could remove threat from a scheme (owner ruling 2026-10-06, docs/phase7-wave7.md §4.1). The engine's
 * `move-threat-source.test.ts` drives the predicate itself; Blackout (`deadpool` 44053) is its first user.
 */
import { describe, expect, it } from "vitest";
import { heroAction } from "./abilities.js";
import { removeThreat } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { canRemoveThreatFrom, each, query, theMainScheme } from "./values.js";

describe("canRemoveThreatFrom", () => {
  it("emits the engine predicate for the scheme ref, with ignoreCrisis only when asked", () => {
    expect(canRemoveThreatFrom(theMainScheme)).toEqual({ kind: "canRemoveThreatFrom", scheme: theMainScheme });
    const withThreat = each(query("scheme", { hasThreat: true }));
    expect(canRemoveThreatFrom(withThreat, { ignoreCrisis: true })).toEqual({
      kind: "canRemoveThreatFrom",
      scheme: withThreat,
      ignoreCrisis: true,
    });
  });

  it("validates as an Action's condition", () => {
    const gated = heroAction({ while: canRemoveThreatFrom(theMainScheme) }, removeThreat(1, theMainScheme));
    expect(validateDefinition(gated)).toEqual([]);
  });
});
