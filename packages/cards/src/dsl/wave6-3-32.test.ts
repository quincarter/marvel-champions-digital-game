/**
 * docs/phase7-wave6.md §3.32 and §4.1 Q22: "that character uses their THW instead of their ATK" (Befuddle 33033).
 * `useThwInsteadOfAtk` emits `modifyBasicPower` with `useStat: "thw"` and no amount (`basic-attack-with-thw.test.ts`
 * in the engine drives it).
 */

import { describe, expect, it } from "vitest";
import { interrupt, on } from "./abilities.js";
import { modifyBasicPower, useThwInsteadOfAtk } from "./effects.js";
import { validateDefinition } from "./validate.js";

describe("§3.32 `useThwInsteadOfAtk`", () => {
  it("Befuddle's shape: 'When a character makes a basic attack against attached minion, …'", () => {
    const definition = interrupt(
      on.attacks({ categories: ["character"] }, { target: { categories: ["minion"] }, basic: true }),
      useThwInsteadOfAtk(),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([{ kind: "modifyBasicPower", useStat: "thw" }]);
  });

  it("modifyBasicPower(n) is unchanged: an amount and no useStat", () => {
    expect(modifyBasicPower(2)).toEqual({ kind: "modifyBasicPower", amount: { kind: "const", value: 2 } });
  });
});
