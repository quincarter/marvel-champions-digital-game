/**
 * docs/phase7-wave6.md §3.67: "After MaGog's hit points are reset". The builders emit the pattern and effect the
 * engine's `hitPointsReset` announcement reads (`hit-points-reset.test.ts` drives them).
 */

import { describe, expect, it } from "vitest";
import { forcedInterrupt, forcedResponse, on } from "./abilities.js";
import { discard, resetHitPoints } from "./effects.js";
import { validateDefinition } from "./validate.js";

describe("§3.67 hit points reset", () => {
  it("MaGog: 'reset his hit points instead' sets the dial past the maximum, which the engine caps", () => {
    const definition = forcedInterrupt(on.defeated("self"), resetHitPoints({ kind: "self" }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      {
        kind: "setRemainingHitPoints",
        target: { kind: "self" },
        amount: { kind: "const", value: Number.MAX_SAFE_INTEGER },
      },
    ]);
  });

  it("Jolt of Adrenaline: 'After MaGog's hit points are reset'", () => {
    const definition = forcedResponse(on.hitPointsReset({ categories: ["villain"] }), discard({ kind: "self" }));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.trigger).toEqual({
      kind: "response",
      forced: true,
      on: { on: "hitPointsReset", targetIs: { categories: ["villain"] } },
    });
    expect(on.hitPointsReset()).toEqual({ on: "hitPointsReset" });
  });
});
