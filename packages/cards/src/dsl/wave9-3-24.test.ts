import { describe, expect, it } from "vitest";
import { rotateEngagement, validateDefinition, whenRevealed } from "./index.js";

describe("rotateEngagement: 'Each player engages each minion engaged with the player clockwise from them'", () => {
  it("builds the effect: every player takes the next player's minions (aos 50135, 50136, 50164)", () => {
    expect(rotateEngagement()).toEqual({ kind: "rotateEngagement", from: "nextPlayer" });
  });

  it("validates as a When Revealed", () => {
    expect(validateDefinition(whenRevealed(rotateEngagement()))).toEqual([]);
  });
});
