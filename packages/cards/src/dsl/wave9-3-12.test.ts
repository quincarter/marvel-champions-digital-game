/**
 * docs/phase7-wave9.md §3.12: `dealtEncounterCards` and `lookAtAndRearrange`, "look at each encounter card dealt to
 * each player and the top card of the encounter deck. You may swap any number of those cards." The engine's
 * `look-rearrange.test.ts` drives the plain data.
 */

import { describe, expect, it } from "vitest";
import { action } from "./abilities.js";
import { anyOfCards, cards, dealtEncounterCards, encounterCards, lookAtAndRearrange, zone } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { self, you } from "./values.js";

const everyDealtAndTheTop = anyOfCards(dealtEncounterCards(), encounterCards(["deck"], undefined, 1));

describe("§3.12 `dealtEncounterCards` and `lookAtAndRearrange`", () => {
  it("`dealtEncounterCards` names every player's dealt cards by default, or one player's", () => {
    expect(dealtEncounterCards()).toEqual({ kind: "dealtEncounter", player: { kind: "each" } });
    expect(dealtEncounterCards(you)).toEqual({ kind: "dealtEncounter", player: { kind: "controller" } });
  });

  it("`lookAtAndRearrange` is a `lookAt` with `rearrange`, seen by `you` unless a viewer is named", () => {
    expect(lookAtAndRearrange(everyDealtAndTheTop, { bind: "seen" })).toEqual({
      kind: "lookAt",
      cards: {
        kind: "anyOf",
        of: [
          { kind: "dealtEncounter", player: { kind: "each" } },
          { kind: "encounter", zones: ["deck"], top: { kind: "const", value: 1 } },
        ],
      },
      viewer: { kind: "controller" },
      bind: "seen",
      rearrange: true,
    });
  });

  it("validates: only dealt encounter cards and deck cards hold positions to rearrange over", () => {
    const problems = (effect: ReturnType<typeof lookAtAndRearrange>) =>
      validateDefinition(action({}, effect)).join("\n");
    expect(problems(lookAtAndRearrange(everyDealtAndTheTop))).toBe("");
    expect(problems(lookAtAndRearrange(zone("deck", you, { top: 3 })))).toBe("");
    expect(problems(lookAtAndRearrange(encounterCards(["deck", "discard"])))).toMatch(/lookAt rearrange/);
    expect(problems(lookAtAndRearrange(zone("hand", you)))).toMatch(/lookAt rearrange/);
    expect(problems(lookAtAndRearrange(anyOfCards(dealtEncounterCards(), cards(self))))).toMatch(/lookAt rearrange/);
  });
});
