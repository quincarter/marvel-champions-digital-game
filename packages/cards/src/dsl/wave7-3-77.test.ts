/**
 * docs/phase7-wave7.md §3.77: the DSL builder for "for each [crisis], [acceleration], [amplify], and [hazard] in
 * play", and the printed shapes composed from it and existing builders. The engine's `icons-in-play-value.test.ts`
 * proves what the value reads.
 */

import { describe, expect, it } from "vitest";
import { action, constant, dealDamage, draw, gets, ifThen } from "./index.js";
import { defineAbilities } from "./validate.js";
import { encounterIconsInPlay, min, valueAtLeast, you } from "./values.js";

describe("§3.77 encounterIconsInPlay", () => {
  it("compiles to the value: every type when none is listed, else the listed ones", () => {
    expect(encounterIconsInPlay()).toEqual({ kind: "iconsInPlay" });
    expect(encounterIconsInPlay(["crisis"])).toEqual({ kind: "iconsInPlay", icons: ["crisis"] });
    expect(encounterIconsInPlay(["amplify", "hazard"])).toEqual({ kind: "iconsInPlay", icons: ["amplify", "hazard"] });
  });

  it("'1 damage for each', '+1 ATK for each (to a maximum of +4)' and 'if [hazard] is on 1 or more cards' validate", () => {
    const all = encounterIconsInPlay();
    const yourIdentity = { categories: ["identity"], controller: "you" } as const;
    const registry = defineAbilities({
      "99077.action": action(dealDamage(all, { kind: "eventTarget" })),
      "99077.constant": constant(gets("atk", min(all, 4), yourIdentity)),
      "99077.checks": action(ifThen(valueAtLeast(encounterIconsInPlay(["hazard"]), 1), draw(1, you))),
    });
    expect(registry["99077.action"]?.effects).toEqual([dealDamage({ kind: "iconsInPlay" }, { kind: "eventTarget" })]);
    expect(registry["99077.constant"]?.trigger).toEqual({
      kind: "constant",
      modifiers: [
        {
          stat: "atk",
          amount: { kind: "min", values: [{ kind: "iconsInPlay" }, { kind: "const", value: 4 }] },
          target: yourIdentity,
        },
      ],
    });
    expect(registry["99077.checks"]?.effects).toEqual([
      ifThen(valueAtLeast({ kind: "iconsInPlay", icons: ["hazard"] }, 1), draw(1, you)),
    ]);
  });
});
