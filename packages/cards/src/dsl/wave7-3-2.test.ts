/** docs/phase7-wave7.md §3.2: the DSL builder for a card left out of the player side scheme limit. */

import { describe, expect, it } from "vitest";
import { excludedFromPlayerSideSchemeLimit } from "./abilities.js";

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
});
