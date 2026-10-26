import { describe, expect, it } from "vitest";
import { layerMarkerSpot } from "./layer-marker.js";

const phoneZone = { x: 8, y: 309, width: 374, height: 262 };

describe("layerMarkerSpot", () => {
  it("sits in the header row past the caption when there is room, even beside the card count", () => {
    const spot = layerMarkerSpot(phoneZone, { width: 110, height: 14, countShown: true });
    expect(spot).toEqual({ x: 140, y: 321 });
    // clear of the count at the right end
    expect(spot.x + 110).toBeLessThanOrEqual(phoneZone.x + phoneZone.width - 8 - 76);
  });

  it("moves above the zone when the count would be covered", () => {
    const narrow = { ...phoneZone, width: 260 };
    const spot = layerMarkerSpot(narrow, { width: 110, height: 14, countShown: true });
    expect(spot.y).toBeLessThan(narrow.y);
    expect(spot.x).toBe(16);
  });

  it("uses the full header when no count is drawn", () => {
    const narrow = { ...phoneZone, width: 260 };
    expect(layerMarkerSpot(narrow, { width: 110, height: 14, countShown: false }).y).toBe(321);
  });

  it("never leaves the top of the screen", () => {
    const top = { x: 0, y: 2, width: 100, height: 100 };
    expect(layerMarkerSpot(top, { width: 110, height: 14, countShown: true }).y).toBe(7);
  });
});
