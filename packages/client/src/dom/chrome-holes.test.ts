import { describe, expect, it } from "vitest";
import { drawnChromeBox, type DrawnObject } from "./chrome-holes.js";

const camera = { x: 0, y: 0, width: 448, height: 784 };
const button = (extra: Partial<DrawnObject> = {}, bounds = { x: 200, y: 92, width: 40, height: 26 }): DrawnObject => ({
  visible: true,
  alpha: 1,
  getBounds: () => bounds,
  ...extra,
});

describe("drawnChromeBox", () => {
  it("cuts a hole for a visible button", () => {
    expect(drawnChromeBox(button(), camera)).toEqual({ x: 200, y: 92, width: 40, height: 26 });
  });
  it("cuts nothing for an invisible object", () => {
    expect(drawnChromeBox(button({ visible: false }), camera)).toBeNull();
  });
  it("cuts nothing for alpha 0", () => {
    expect(drawnChromeBox(button({ alpha: 0 }), camera)).toBeNull();
  });
  it("cuts nothing under an invisible parent container", () => {
    expect(drawnChromeBox(button({ parentContainer: { visible: false } }), camera)).toBeNull();
    expect(
      drawnChromeBox(button({ parentContainer: { alpha: 0, parentContainer: { visible: true } } }), camera),
    ).toBeNull();
  });
  it("cuts nothing for a zero-size object", () => {
    expect(drawnChromeBox(button({}, { x: 10, y: 10, width: 0, height: 20 }), camera)).toBeNull();
  });
  it("cuts nothing for an object off the camera", () => {
    expect(drawnChromeBox(button({}, { x: 500, y: 10, width: 40, height: 20 }), camera)).toBeNull();
  });
  it("clips a hole to the camera", () => {
    expect(drawnChromeBox(button({}, { x: 430, y: 10, width: 40, height: 20 }), camera)).toEqual({
      x: 430,
      y: 10,
      width: 18,
      height: 20,
    });
  });
  it("cuts nothing for an object without bounds", () => {
    expect(drawnChromeBox({ visible: true }, camera)).toBeNull();
  });
});
