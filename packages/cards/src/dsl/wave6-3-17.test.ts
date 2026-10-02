/**
 * docs/phase7-wave6.md §3.17: resolving a card's "When Defeated" abilities on demand. `resolveWhenDefeatedOf` emits the
 * `resolveSpecials.trigger: "whenDefeated"` the engine reads (`resolve-when-defeated.test.ts` drives it).
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { whenRevealed } from "./abilities.js";
import { ifThen, resolveWhenDefeatedOf } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { each, not, query, self, varAtLeast, you } from "./values.js";

describe("§3.17 `resolveWhenDefeatedOf`", () => {
  it("Zeal for the Cause's shape: each Acolyte minion engaged with you, with a count for the fallback", () => {
    const acolytes = each(query("minion", { trait: trait("ACOLYTE"), engagedWith: "you" }));
    const definition = whenRevealed(
      resolveWhenDefeatedOf(acolytes, { bind: "zeal" }),
      ifThen(not(varAtLeast("zeal.count")), []),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects[0]).toEqual({
      kind: "resolveSpecials",
      of: acolytes,
      trigger: "whenDefeated",
      bind: "zeal",
    });
  });

  it("`player` names the resolving player; without options only `of` and the trigger are set", () => {
    expect(resolveWhenDefeatedOf(self, { player: you })).toEqual({
      kind: "resolveSpecials",
      of: self,
      trigger: "whenDefeated",
      player: { kind: "controller" },
    });
    expect(resolveWhenDefeatedOf(self)).toEqual({ kind: "resolveSpecials", of: self, trigger: "whenDefeated" });
  });
});
