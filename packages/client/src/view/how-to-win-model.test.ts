import { describe, expect, it } from "vitest";
import { rectsOverlap } from "./layout.js";
import {
  EVERY_ROUND_STEPS,
  HOW_TO_WIN_FOCUS_ORDER,
  howToWinContent,
  howToWinLayout,
  howToWinLayoutRects,
} from "./how-to-win-model.js";

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

describe("howToWinLayout", () => {
  const sizes: readonly [number, number][] = [
    [390, 844], // phone
    [1024, 768], // tablet landscape
    [1440, 900], // desktop
  ];

  for (const [width, height] of sizes) {
    it(`lays out every region with no overlap at ${width}x${height}`, () => {
      const layout = howToWinLayout(width, height);
      const rects = howToWinLayoutRects(layout);
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
        }
      }
      for (const rect of rects) {
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.width).toBeGreaterThan(0);
        expect(rect.height).toBeGreaterThan(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
        expect(rect.y + rect.height).toBeLessThanOrEqual(height + 1);
      }
    });
  }

  it("is narrow (stacked) on phone and wide (two columns) on tablet landscape/desktop", () => {
    expect(howToWinLayout(390, 844).wide).toBe(false);
    expect(howToWinLayout(1024, 768).wide).toBe(true);
    expect(howToWinLayout(1440, 900).wide).toBe(true);
  });

  it("puts the WIN card and the two LOSE cards side by side on wide layouts", () => {
    const layout = howToWinLayout(1440, 900);
    expect(layout.win.x).toBeLessThan(layout.loseScheme.x);
    expect(layout.win.x).toBeLessThan(layout.loseHero.x);
    expect(layout.loseScheme.y).toBeLessThan(layout.loseHero.y);
  });

  it("stacks WIN above both LOSE cards on narrow layouts", () => {
    const layout = howToWinLayout(390, 844);
    expect(layout.win.y).toBeLessThan(layout.loseScheme.y);
    expect(layout.loseScheme.y).toBeLessThan(layout.loseHero.y);
  });

  it("caps the wide content column at ~1200, centred, instead of stretching edge to edge", () => {
    const layout = howToWinLayout(1440, 900);
    expect(layout.title.width).toBeLessThanOrEqual(1200);
    // Centred: equal space to the left of the title and to the right of the screen's own right edge.
    const rightMargin = 1440 - (layout.title.x + layout.title.width);
    expect(layout.title.x).toBeCloseTo(rightMargin, 0);
  });

  for (const [width, height] of [
    [1024, 768],
    [1440, 900],
  ] as const) {
    it(`fills most of the height between the headline and the EVERY ROUND strip with cards at ${width}x${height}`, () => {
      const layout = howToWinLayout(width, height);
      const available = layout.everyRound.y - (layout.title.y + layout.title.height);
      expect(layout.win.height).toBeGreaterThanOrEqual(available * 0.6);
    });
  }
});

describe("HOW_TO_WIN_FOCUS_ORDER", () => {
  it("always ends on the two forward actions, close first", () => {
    expect(HOW_TO_WIN_FOCUS_ORDER[0]).toBe("close");
    expect(HOW_TO_WIN_FOCUS_ORDER.at(-1)).toBe("start-the-fight");
    expect(HOW_TO_WIN_FOCUS_ORDER).toContain("tell-me-more");
  });
});
