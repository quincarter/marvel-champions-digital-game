import { describe, expect, it } from "vitest";
import type { GameState } from "@mc/engine";
import {
  reviewHandleRect,
  showReviewHandle,
  slideOffset,
  villainSlideEdge,
  type VillainReview,
} from "./villain-review.js";
import { emptyWalkthrough } from "./villain-walkthrough.js";

const game = (round: number, phase: string, outcome: unknown = null): GameState =>
  ({ round, step: { phase }, outcome }) as unknown as GameState;
const review = (round: number): VillainReview => ({
  round,
  walkthrough: emptyWalkthrough(round),
  before: null,
  after: game(round + 1, "player"),
  viewer: null,
});

describe("villain review", () => {
  it("offers the handle in the next round's player phase only", () => {
    expect(showReviewHandle(review(1), game(2, "player"))).toBe(true);
    expect(showReviewHandle(review(1), game(2, "villain"))).toBe(false);
    expect(showReviewHandle(review(1), game(3, "player"))).toBe(false);
    expect(showReviewHandle(review(1), game(2, "player", { result: "won" }))).toBe(false);
    expect(showReviewHandle(null, game(2, "player"))).toBe(false);
  });

  it("slides the rail from the right, the band from the top and the tab from the bottom, fully off screen", () => {
    const viewport = { x: 0, y: 0, width: 1440, height: 900 };
    expect(villainSlideEdge("desktop")).toBe("right");
    expect(villainSlideEdge("tabletLandscape")).toBe("top");
    expect(villainSlideEdge("phone")).toBe("bottom");
    expect(villainSlideEdge("tabletPortrait")).toBe("bottom");
    const rail = { x: 965, y: 64, width: 475, height: 836 };
    expect(slideOffset("right", rail, viewport)).toEqual({ dx: 475, dy: 0 });
    const band = { x: 8, y: 44, width: 1008, height: 256 };
    expect(slideOffset("top", band, viewport)).toEqual({ dx: 0, dy: -300 });
    const tab = { x: 0, y: 40, width: 390, height: 540 };
    expect(slideOffset("bottom", tab, { x: 0, y: 0, width: 390, height: 844 })).toEqual({ dx: 0, dy: 804 });
  });

  it("hangs the handle on the right edge, between the chrome and the hand", () => {
    const rect = reviewHandleRect({ x: 0, y: 0, width: 1440, height: 900 }, 64, 620);
    expect(rect.x + rect.width).toBe(1440);
    expect(rect.y).toBeGreaterThanOrEqual(64);
    expect(rect.y + rect.height).toBeLessThanOrEqual(620);
    expect(rect.height).toBeGreaterThanOrEqual(120);
  });
});
