/** docs/phase7-wave7.md §3.2: the DSL builder for a card left out of the player side scheme limit. */

import { describe, expect, it } from "vitest";
import { constant, excludedFromPlayerSideSchemeLimit } from "./abilities.js";
import { defineAbilities } from "./validate.js";

describe("excludedFromPlayerSideSchemeLimit", () => {
  it("compiles to the engine's rule, with its condition when one is given", () => {
    expect(excludedFromPlayerSideSchemeLimit({ self: true })).toEqual({
      rules: [{ kind: "excludedFromPlayerSideSchemeLimit", target: { self: true } }],
    });
    const inHeroForm = { kind: "form", player: { kind: "controller" }, form: "hero" } as const;
    expect(excludedFromPlayerSideSchemeLimit({ self: true }, { while: inHeroForm })).toEqual({
      rules: [{ kind: "excludedFromPlayerSideSchemeLimit", target: { self: true }, while: inHeroForm }],
    });
  });

  // Owner ruling 1 (2026-10-04): a campaign player side scheme is out of the limit by its own text, "This scheme does
  // not count against the player side scheme limit." The scheme declares it on itself, as a constant ability targeting
  // itself (`next_evol` 40190a–40195a). The compiled definition is exactly the one the engine's `player-side-scheme-limit.test.ts` puts on a scheme
  // no player owns ("owner ruling 1"), where it leaves that scheme out of the count, the slot and the discard choice.
  it("a scheme declares it on itself: a constant ability targeting itself, which validates", () => {
    const registry = defineAbilities({
      "40190a.limit-constant": constant(excludedFromPlayerSideSchemeLimit({ self: true })),
    });
    expect(registry["40190a.limit-constant"]).toEqual({
      trigger: { kind: "constant", rules: [{ kind: "excludedFromPlayerSideSchemeLimit", target: { self: true } }] },
      effects: [],
    });
  });
});
