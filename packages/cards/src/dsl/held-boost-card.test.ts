/**
 * `giveHeldBoostCard` (engine `EffectSpec giveBoostCard.forBasicPower`): "Give Elektra 1 facedown boost card"
 * (Acrobatic Prowess 63006) and "give this card to Elektra as a facedown boost card" (the Ninja cards 63002–63004), a
 * boost card held for a friendly character's next basic power (ruling September 10, 2026 - Ruling 3 (A)). The builder's
 * shapes, and that the validator lets a Boost ability give its own card that way.
 */

import { describe, expect, it } from "vitest";
import { boost, giveHeldBoostCard, heroAction, self, yourIdentity } from "./index.js";
import { validateDefinition } from "./validate.js";

describe("giveHeldBoostCard", () => {
  it("one card off the encounter deck, held for the character's basic powers", () => {
    expect(giveHeldBoostCard(yourIdentity)).toEqual({
      kind: "giveBoostCard",
      enemy: yourIdentity,
      forBasicPower: true,
    });
  });

  it("a count", () => {
    expect(giveHeldBoostCard(yourIdentity, 2)).toEqual({
      kind: "giveBoostCard",
      enemy: yourIdentity,
      count: { kind: "const", value: 2 },
      forBasicPower: true,
    });
  });

  it("a named card: 'give this card to Elektra as a facedown boost card'", () => {
    expect(giveHeldBoostCard(yourIdentity, { card: self })).toEqual({
      kind: "giveBoostCard",
      enemy: yourIdentity,
      card: self,
      forBasicPower: true,
    });
  });

  it("validates as a hero action and inside a Boost ability", () => {
    expect(validateDefinition(heroAction({}, giveHeldBoostCard(yourIdentity)))).toEqual([]);
    expect(validateDefinition(boost(giveHeldBoostCard(yourIdentity, { card: self })))).toEqual([]);
  });
});
