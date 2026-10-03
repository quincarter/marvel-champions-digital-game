/**
 * docs/phase7-wave6.md §3.50: the DSL side of "You gain each of the attached character's TRAITS until the end of the
 * round." (Skin Contact, `rogue` 38001a; Energy Transfer, 38007). `gainTraitsOfUntil` compiles to the engine's
 * `grantTraitUntil` with `traitsOf` (and `whileAttached`); the engine's `copy-traits.test.ts` drives the behavior.
 *
 * Owner decision §4.1 Q28: "Rogue's copied traits are live, for as long as Touched stays on that character". Built as:
 * the host's current traits on every read, ending at the end of the round or when Touched leaves that host, whichever
 * comes first. Shapes only (Rogue's own cards are scripted elsewhere).
 */

import type { EffectSpec } from "@mc/engine";
import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { action, attachCost } from "./abilities.js";
import { gainTraitsOfUntil, gainTraitUntil } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, find, identityOf, query, yourIdentity, you } from "./values.js";

const TOUCHED = query("upgrade", { name: "Touched" });
const OTHER_CHARACTER = query("character", { excluding: yourIdentity });

describe("§3.50 gainTraitsOfUntil", () => {
  it("compiles to grantTraitUntil with traitsOf, and whileAttached defaults its host to the source", () => {
    expect(gainTraitsOfUntil(chosen("host"), yourIdentity, "endOfRound")).toEqual({
      kind: "grantTraitUntil",
      traitsOf: { kind: "slot", slot: "host" },
      target: identityOf(you),
      until: "endOfRound",
    });
    expect(gainTraitsOfUntil(chosen("host"), yourIdentity, "endOfRound", { whileAttached: chosen("touched") })).toEqual(
      {
        kind: "grantTraitUntil",
        traitsOf: { kind: "slot", slot: "host" },
        target: identityOf(you),
        until: "endOfRound",
        whileAttached: { card: { kind: "slot", slot: "touched" }, to: { kind: "slot", slot: "host" } },
      },
    );
    const elsewhere = gainTraitsOfUntil(chosen("host"), yourIdentity, "endOfPhase", {
      whileAttached: chosen("touched"),
      to: chosen("other"),
    });
    expect(elsewhere.kind === "grantTraitUntil" && elsewhere.whileAttached?.to).toEqual({
      kind: "slot",
      slot: "other",
    });
  });

  it("Energy Transfer's shape validates: the cost binds the host and Touched, the effect reads both", () => {
    const definition = action(
      { cost: attachCost(find(TOUCHED, { owner: you }), OTHER_CHARACTER, "host", { bind: "touched" }) },
      gainTraitsOfUntil(chosen("host"), yourIdentity, "endOfRound", { whileAttached: chosen("touched") }),
    );
    expect(validateDefinition(definition)).toEqual([]);
  });

  it("near miss: reading a slot nothing binds is refused", () => {
    const definition = action(
      { cost: attachCost(find(TOUCHED, { owner: you }), OTHER_CHARACTER, "host") },
      gainTraitsOfUntil(chosen("host"), yourIdentity, "endOfRound", { whileAttached: chosen("touched") }),
    );
    expect(validateDefinition(definition).join(" ")).toContain('slot "touched"');
  });

  it("refuses a trait grant with both or neither of trait and traitsOf; the one-trait form is unchanged", () => {
    const both = { ...gainTraitUntil(trait("AERIAL"), yourIdentity, "endOfPhase"), traitsOf: yourIdentity };
    const neither = { kind: "grantTraitUntil", target: yourIdentity, until: "endOfPhase" };
    const problems = (effect: unknown) => validateDefinition(action({}, effect as EffectSpec)).join(" ");
    expect(problems(both)).toContain("needs exactly one of trait and traitsOf");
    expect(problems(neither)).toContain("needs exactly one of trait and traitsOf");
    expect(problems(gainTraitUntil(trait("AERIAL"), yourIdentity, "endOfPhase"))).toBe("");
    expect(problems(gainTraitsOfUntil({ kind: "villain" }, yourIdentity, "endOfRound"))).toBe("");
  });
});
