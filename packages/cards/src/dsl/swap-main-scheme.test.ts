/**
 * `swapMainScheme` and `yourMainScheme` (docs/phase7-wave11-scenarios.md §S3.2): the DSL side of "Swap your main scheme
 * with a random set-aside main scheme. Place the threat from the previous scheme on the new scheme." (Change of Venue,
 * `fne` 60141). The engine's `resolve/swap-main-scheme.test.ts` drives the swap itself.
 */
import { describe, expect, it } from "vitest";
import { whenRevealed } from "./abilities.js";
import { encounterSetAside, selectCards, swapMainScheme } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, query, yourMainScheme } from "./values.js";

describe("swapMainScheme", () => {
  it("emits swapCards with placePreviousThreat only when asked", () => {
    expect(swapMainScheme(yourMainScheme, chosen("venue"), { placePreviousThreat: true })).toEqual({
      kind: "swapCards",
      a: { kind: "mainScheme", of: "yours" },
      b: { kind: "slot", slot: "venue" },
      placePreviousThreat: true,
    });
    expect(swapMainScheme(yourMainScheme, chosen("venue"))).toEqual({
      kind: "swapCards",
      a: { kind: "mainScheme", of: "yours" },
      b: { kind: "slot", slot: "venue" },
    });
  });

  it("Change of Venue's When Revealed validates", () => {
    const definition = whenRevealed(
      selectCards("venue", encounterSetAside(query("mainScheme"), { random: 1 })),
      swapMainScheme(yourMainScheme, chosen("venue"), { placePreviousThreat: true }),
    );
    expect(validateDefinition(definition)).toEqual([]);
  });
});
