/**
 * docs/phase7-wave6.md §3.16: giving a chosen card as a boost card. `giveBoostCard(theVillain, { card })` emits the
 * `giveBoostCard.card` the engine reads (`give-chosen-boost-card.test.ts` drives it).
 */

import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { whenRevealed } from "./abilities.js";
import { atMost, encounterCards, enemyScheme, giveBoostCard, selectCards } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { chosen, theVillain, you } from "./values.js";

describe("§3.16 `giveBoostCard(theVillain, { card })`", () => {
  it("Master of Magnetism's shape: take the topmost matching discard, give it facedown, the villain activates", () => {
    const definition = whenRevealed(
      selectCards("magnetic", atMost(1, encounterCards(["discard"], { trait: trait("MAGNETIC") }))),
      giveBoostCard(theVillain, { card: chosen("magnetic") }),
      enemyScheme(theVillain, { against: you }),
    );
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects[1]).toEqual({
      kind: "giveBoostCard",
      enemy: { kind: "villain" },
      card: { kind: "slot", slot: "magnetic" },
    });
  });

  it("without a card, the count form is unchanged", () => {
    expect(giveBoostCard(theVillain, 2)).toEqual({
      kind: "giveBoostCard",
      enemy: { kind: "villain" },
      count: { kind: "const", value: 2 },
    });
    expect(giveBoostCard()).not.toHaveProperty("card");
  });

  it("the validator rejects a chosen card with a count", () => {
    const definition = whenRevealed({
      kind: "giveBoostCard",
      enemy: theVillain,
      card: chosen("x"),
      count: { kind: "const", value: 2 },
    });
    expect(validateDefinition(definition).join("\n")).toMatch(/chosen card is given once/);
  });
});
