import { describe, expect, test } from "vitest";
import {
  BESIDE_GAP,
  TALL_METER_GROWTH,
  besideBoxWidth,
  tallGrowthFor,
  threatMeterLayout,
} from "./threat-meter-layout.js";

const METER = { x: 100, y: 50, width: 280, height: 18 };

describe("threatMeterLayout", () => {
  test("box: the bar fills the meter and the chip sits 2px in, centered, as wide as the text", () => {
    const layout = threatMeterLayout(METER, "box", 120);
    expect(layout.bar).toEqual(METER);
    expect(layout.countBox).toEqual({ x: 180, y: 52, width: 120, height: 14 });
    expect(layout.countCenter).toEqual({ x: 240, y: 58 });
    expect(layout.chip).toBe(true);
  });

  test("tall: the bar grows upward only, and the chip keeps its height so the fill shows above and below it", () => {
    const layout = threatMeterLayout(METER, "tall", 120);
    expect(layout.bar).toEqual({ ...METER, y: 50 - TALL_METER_GROWTH, height: 18 + TALL_METER_GROWTH });
    expect(layout.bar.y + layout.bar.height).toBe(METER.y + METER.height);
    expect(layout.countBox!.height).toBe(14);
    expect(layout.countBox!.y - layout.bar.y).toBe(5);
    expect(layout.bar.y + layout.bar.height - (layout.countBox!.y + layout.countBox!.height)).toBe(5);
  });

  test("tall on a slim side scheme row: the bar grows downward only, keeping clear of the subtitle above it", () => {
    const slim = { x: 100, y: 50, width: 280, height: 14 };
    const growth = tallGrowthFor(0, 4);
    expect(growth).toEqual({ up: 0, down: 4 });
    const layout = threatMeterLayout(slim, "tall", 60, growth);
    expect(layout.bar.y).toBe(slim.y);
    expect(layout.bar.height).toBe(18);
    expect(layout.countBox!.height).toBe(10);
  });

  test("tallGrowthFor takes the room above first, then the rest below, never more than the full growth", () => {
    expect(tallGrowthFor(20, 20)).toEqual({ up: TALL_METER_GROWTH, down: 0 });
    expect(tallGrowthFor(2.6, 20)).toEqual({ up: 2, down: TALL_METER_GROWTH - 2 });
    expect(tallGrowthFor(-3, 1)).toEqual({ up: 0, down: 1 });
    expect(tallGrowthFor(-3, -2)).toEqual({ up: 0, down: 0 });
  });

  test("beside: the count gets its own box at the right end, and nothing covers the bar", () => {
    const layout = threatMeterLayout(METER, "beside");
    const boxWidth = besideBoxWidth(METER.width);
    expect(layout.countBox).toEqual({ x: 100 + 280 - boxWidth, y: 50, width: boxWidth, height: 18 });
    expect(layout.bar).toEqual({ ...METER, width: 280 - boxWidth - BESIDE_GAP });
    expect(layout.bar.x + layout.bar.width).toBeLessThan(layout.countBox!.x);
    expect(layout.chip).toBe(false);
  });

  test("outline: the bar fills the meter and the count has no box", () => {
    const layout = threatMeterLayout(METER, "outline");
    expect(layout.bar).toEqual(METER);
    expect(layout.countBox).toBeNull();
  });

  test("a chip never runs past the bar's ends", () => {
    expect(threatMeterLayout(METER, "box", 900).countBox!.width).toBe(276);
  });

  test("the beside box is about a third of the meter, at least 54px, never over half", () => {
    expect(besideBoxWidth(280)).toBe(84);
    expect(besideBoxWidth(120)).toBe(54);
    expect(besideBoxWidth(90)).toBe(45);
  });
});
