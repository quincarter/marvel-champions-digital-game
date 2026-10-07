/**
 * docs/phase7-wave7.md §3.44: `treatAttachedAllyAsMinion`'s `schFromThw`, the two printed readings of "Attached
 * minion's SCH is equal to its [printed] THW" (§4.1 Q27). The engine's `treat-as-minion-attached.test.ts` drives both.
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { constant, treatAttachedAllyAsMinion } from "./abilities.js";
import { validateDefinition } from "./validate.js";

const POSSESSED = trait("POSSESSED");

describe("§3.44 an ally treated as a minion: SCH from its THW", () => {
  it("'its printed THW' is the default; 'its THW' is schFromThw 'current'", () => {
    expect(treatAttachedAllyAsMinion([POSSESSED]).rules).toEqual([
      { kind: "treatHostAsMinion", traits: [POSSESSED], schFromThw: true },
    ]);
    expect(treatAttachedAllyAsMinion([POSSESSED], { schFromThw: "printed" }).rules).toEqual([
      { kind: "treatHostAsMinion", traits: [POSSESSED], schFromThw: true },
    ]);
    const definition = constant(
      treatAttachedAllyAsMinion([POSSESSED], { keepPrintedTraits: true, schFromThw: "current" }),
    );
    expect(definition.trigger).toEqual({
      kind: "constant",
      rules: [{ kind: "treatHostAsMinion", traits: [POSSESSED], schFromThw: "current", keepPrintedTraits: true }],
    });
    expect(validateDefinition(definition)).toEqual([]);
  });
});
