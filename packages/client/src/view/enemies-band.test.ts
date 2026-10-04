import { describe, expect, test } from "vitest";
import { bandHeightWithMinions, MINION_ROW_MIN_HEIGHT } from "./enemies-band.js";

describe("the villain band with minions in the zone", () => {
  test("with no minions the band keeps its height", () => {
    expect(bandHeightWithMinions(150, 128, 56, 0)).toBe(128);
  });

  test("a zone with room for a readable minion row leaves the band alone", () => {
    expect(bandHeightWithMinions(300, 128, 56, 3)).toBe(128);
  });

  test("a short zone gives band height back so the row keeps its minimum", () => {
    const band = bandHeightWithMinions(212, 128, 56, 3);
    expect(band).toBeLessThan(128);
    // zone padding above and below, the gap, the band, and the row add up to the zone.
    expect(212 - 10 - band - 8 - 10).toBeGreaterThanOrEqual(MINION_ROW_MIN_HEIGHT);
  });

  test("the band never goes below its floor, however short the zone", () => {
    expect(bandHeightWithMinions(100, 128, 56, 3)).toBe(56);
    // A floor equal to the base is a band that never gives anything back (the single villain's wide panel).
    expect(bandHeightWithMinions(100, 128, 128, 3)).toBe(128);
  });
});
