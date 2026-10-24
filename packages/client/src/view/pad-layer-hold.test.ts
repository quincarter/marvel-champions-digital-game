import { describe, expect, it } from "vitest";
import {
  NO_TRIGGERS,
  isLayerButton,
  layerOfHold,
  layerOfHolds,
  nextAbilityPage,
  triggerHoldAfter,
} from "./pad-layer-hold.js";

describe("trigger hold", () => {
  it("engages past 0.5 and releases below 0.35 (hysteresis)", () => {
    let hold = triggerHoldAfter(NO_TRIGGERS, 0.45, 0);
    expect(hold.lt).toBe(false);
    hold = triggerHoldAfter(hold, 0.6, 0);
    expect(hold.lt).toBe(true);
    hold = triggerHoldAfter(hold, 0.4, 0);
    expect(hold.lt).toBe(true);
    hold = triggerHoldAfter(hold, 0.3, 0);
    expect(hold.lt).toBe(false);
    expect(layerOfHold(hold)).toBeNull();
  });

  it("keeps the same object when nothing changed", () => {
    expect(triggerHoldAfter(NO_TRIGGERS, 0, 0)).toBe(NO_TRIGGERS);
  });

  it("the first trigger pulled wins until it is released", () => {
    let hold = triggerHoldAfter(NO_TRIGGERS, 0, 1);
    expect(layerOfHold(hold)).toBe("rt");
    hold = triggerHoldAfter(hold, 1, 1);
    expect(layerOfHold(hold)).toBe("rt");
    hold = triggerHoldAfter(hold, 1, 0);
    expect(layerOfHold(hold)).toBe("lt");
  });

  it("both pulled in one frame is LT", () => {
    expect(layerOfHold(triggerHoldAfter(NO_TRIGGERS, 1, 1))).toBe("lt");
  });

  it("across pads, the layer already in force stays while some pad holds it", () => {
    const rt = triggerHoldAfter(NO_TRIGGERS, 0, 1);
    const lt = triggerHoldAfter(NO_TRIGGERS, 1, 0);
    expect(layerOfHolds([lt, rt], "rt")).toBe("rt");
    expect(layerOfHolds([lt, rt], null)).toBe("lt");
    expect(layerOfHolds([NO_TRIGGERS], "rt")).toBeNull();
    expect(layerOfHolds([], null)).toBeNull();
  });

  it("layer buttons are faces and bumpers only", () => {
    expect([0, 1, 2, 3, 4, 5].every(isLayerButton)).toBe(true);
    expect([6, 7, 8, 9, 12].some(isLayerButton)).toBe(false);
  });

  it("pages wrap both ways", () => {
    expect(nextAbilityPage(0, 3, 1)).toBe(1);
    expect(nextAbilityPage(2, 3, 1)).toBe(0);
    expect(nextAbilityPage(0, 3, -1)).toBe(2);
    expect(nextAbilityPage(0, 1, 1)).toBe(0);
  });
});
