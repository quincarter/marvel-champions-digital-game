/**
 * docs/phase7-wave11.md §3.5: "Threat cannot be removed from this scheme except by Daredevil or Matt Murdock."
 * `onlySourceRemovesThreat` is `RuleSpec threatCannotBeRemoved.exceptFromSource`
 * (`threat-cannot-be-removed-except-from-source.test.ts` in the engine drives it; RRG 1.8 "You, Your", p. 49).
 */

import { describe, expect, it } from "vitest";
import { onlySourceRemovesThreat } from "./abilities.js";

describe("§3.5 threat removable only by one identity and its extensions", () => {
  it("names the scheme and the removing card's query", () => {
    expect(onlySourceRemovesThreat({ self: true }, { extensionOf: { kind: "controller" } })).toEqual({
      rules: [
        {
          kind: "threatCannotBeRemoved",
          target: { self: true },
          exceptFromSource: { extensionOf: { kind: "controller" } },
        },
      ],
    });
  });
});
