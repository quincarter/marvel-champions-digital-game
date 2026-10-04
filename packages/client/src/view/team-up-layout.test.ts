import { describe, expect, test } from "vitest";
import { badgeLabelRect, columnRings, ringDiameterFor, rowRings, splashLayout } from "./team-up-layout.js";

const IMAGE = { width: 719, height: 1111 };

describe("splashLayout", () => {
  test("a desktop window is height-limited: the whole picture, contained, with the title above it", () => {
    const { picture, title } = splashLayout({ width: 1440, height: 900 }, IMAGE);
    expect(picture.height).toBeLessThanOrEqual(900 - 24 - 40 - 10);
    expect(picture.width / picture.height).toBeCloseTo(IMAGE.width / IMAGE.height, 2);
    expect(picture.x + picture.width / 2).toBeCloseTo(720, -1);
    expect(title.y + title.height).toBeLessThan(picture.y);
    expect(picture.y + picture.height).toBeLessThanOrEqual(900);
    expect(title.y).toBeGreaterThanOrEqual(0);
  });

  test("a portrait phone is width-limited and still fits on screen", () => {
    const { picture, title } = splashLayout({ width: 390, height: 844 }, IMAGE);
    expect(picture.width).toBeLessThanOrEqual(390 - 24);
    expect(picture.x).toBeGreaterThanOrEqual(12);
    expect(picture.y + picture.height).toBeLessThanOrEqual(844);
    expect(title.x + title.width).toBeLessThanOrEqual(390);
  });

  test("a short landscape phone shrinks the picture rather than cropping it", () => {
    const { picture } = splashLayout({ width: 844, height: 390 }, IMAGE);
    expect(picture.y).toBeGreaterThanOrEqual(0);
    expect(picture.y + picture.height).toBeLessThanOrEqual(390);
  });
});

describe("columnRings", () => {
  const free = { x: 200, y: 420, width: 100, height: 110 };

  test("no keys, no rings", () => {
    expect(columnRings(free, [], 64)).toEqual([]);
  });

  test("one ring is centered in the free gap, right-aligned, and inside it", () => {
    const [slot] = columnRings(free, ["gambit-rogue"], 64);
    expect(slot!.cx + slot!.radius).toBe(300);
    expect(slot!.cy).toBe(475);
    expect(slot!.cy - slot!.radius).toBeGreaterThanOrEqual(free.y);
    expect(slot!.cy + slot!.radius).toBeLessThanOrEqual(free.y + free.height);
  });

  test("a gap shorter than the ring shrinks it, down to a floor", () => {
    expect(columnRings({ ...free, height: 50 }, ["k"], 64)[0]!.radius * 2).toBe(50);
    expect(columnRings({ ...free, height: 10 }, ["k"], 64)[0]!.radius * 2).toBe(32);
  });

  test("a second ring goes left of the first only when the column is wide enough", () => {
    expect(columnRings(free, ["a", "b"], 64).map((slot) => slot.key)).toEqual(["a"]);
    const wide = columnRings({ ...free, width: 200 }, ["a", "b", "c"], 48);
    expect(wide.map((slot) => slot.key)).toEqual(["a", "b"]);
    expect(wide[0]!.cx - wide[1]!.cx).toBeGreaterThan(48);
  });

  test("the phone diameter is smaller than the desktop one", () => {
    expect(ringDiameterFor(true)).toBe(48);
    expect(ringDiameterFor(false)).toBe(64);
  });
});

describe("rowRings", () => {
  const row = { x: 10, y: 50, width: 240, height: 76 };

  test("the row gives up width on the right, and the ring is centered on it", () => {
    const out = rowRings(row, ["k"], 64);
    expect(out.slots).toHaveLength(1);
    expect(out.slots[0]!.cy).toBe(88);
    expect(out.row.x + out.row.width).toBeLessThanOrEqual(out.slots[0]!.cx - out.slots[0]!.radius);
    expect(out.slots[0]!.cx + out.slots[0]!.radius).toBe(250);
  });

  test("a short row shrinks the ring to fit", () => {
    const out = rowRings({ ...row, height: 40 }, ["k"], 64);
    expect(out.slots[0]!.radius * 2).toBeLessThanOrEqual(36);
  });

  test("no keys leaves the row alone", () => {
    expect(rowRings(row, [], 64)).toEqual({ row, slots: [] });
  });
});

describe("badgeLabelRect", () => {
  test("hangs under the circle and stays inside a narrow viewport", () => {
    const slot = { key: "k", cx: 30, cy: 22, radius: 18 };
    const rect = badgeLabelRect(slot, { width: 240, height: 24 }, { width: 390 });
    expect(rect.x).toBeGreaterThanOrEqual(4);
    expect(rect.x + rect.width).toBeLessThanOrEqual(386);
    expect(rect.y).toBeGreaterThan(slot.cy + slot.radius);
  });
});
