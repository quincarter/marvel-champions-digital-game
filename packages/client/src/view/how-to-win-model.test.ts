import { describe, expect, it } from "vitest";
import { EVERY_ROUND_STEPS, howToWinContent } from "./how-to-win-model.js";

describe("howToWinContent", () => {
  it("reads the tutorial matchup's real numbers, not the design tile's placeholders", () => {
    const content = howToWinContent();
    expect(content.villainName).toBe("Rhino");
    // Standard is stage I -> stage II: two stages, never the design tile's Crossbones art or count.
    expect(content.stageCount).toBe(2);
    expect(content.mainSchemeName).toBe("The Break-In!");
    // The Break-In! stage 1: base 0 + 7 per player, scaled for the tutorial's one player.
    expect(content.threatTarget).toBe(7);
    expect(content.heroName).toBe("Spider-Man");
    expect(content.heroHp).toBe(10);
  });

  it("is stable across calls (same pool, same scenario)", () => {
    expect(howToWinContent()).toEqual(howToWinContent());
  });
});

describe("EVERY_ROUND_STEPS", () => {
  it("orders draw-up before the villain phase, per RRG (draw back up at the end of your own turn)", () => {
    expect(EVERY_ROUND_STEPS).toEqual(["YOU ACT & DRAW UP", "VILLAIN ACTS"]);
  });
});
