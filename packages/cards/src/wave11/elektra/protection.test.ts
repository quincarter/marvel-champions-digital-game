import { describe, expect, it } from "vitest";
import { ELEKTRA_PROTECTION as REGISTRY, ELEKTRA_PROTECTION_SKIPPED as SKIPPED } from "./protection.js";

/**
 * Wave 11 `elektra/protection`: Moon Knight 63039 is deliberately not scripted (its mental line needs an engine primitive, see protection.ts
 * ), so the module registers
 * nothing and says why. A subtly wrong Moon Knight is worse than none.
 */
describe("registry", () => {
  it("registers nothing and skips Moon Knight's interrupt with its written reason", () => {
    expect(Object.keys(REGISTRY)).toEqual([]);
    expect(Object.keys(SKIPPED)).toEqual(["63039.moon-knight-interrupt"]);
    expect(SKIPPED["63039.moon-knight-interrupt"]).toContain("needs engine primitive");
  });
});
