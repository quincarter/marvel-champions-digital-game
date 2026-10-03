import { describe, expect, test } from "vitest";
import { badgeLabelRect, badgeSlots, splashLayout } from "./team-up-layout.js";

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

describe("badgeSlots", () => {
  const bar = { x: 0, y: 0, width: 1440, height: 44 };

  test("no keys, no slots, and the edge does not move", () => {
    expect(badgeSlots(bar, 900, [])).toEqual({ slots: [], leftEdge: 900 });
  });

  test("one circle sits inside the bar, right-aligned", () => {
    const { slots, leftEdge } = badgeSlots(bar, 900, ["gambit-rogue"]);
    expect(slots).toHaveLength(1);
    const [slot] = slots;
    expect(slot!.cx + slot!.radius).toBe(900);
    expect(slot!.cy).toBe(22);
    expect(slot!.cy - slot!.radius).toBeGreaterThanOrEqual(0);
    expect(slot!.cy + slot!.radius).toBeLessThanOrEqual(44);
    expect(leftEdge).toBe(900 - slot!.radius * 2);
  });

  test("several circles do not overlap, and the row is capped", () => {
    const { slots } = badgeSlots(bar, 900, ["a", "b", "c", "d"]);
    expect(slots.map((slot) => slot.key)).toEqual(["a", "b", "c"]);
    expect(slots[0]!.cx - slots[1]!.cx).toBeGreaterThan(slots[0]!.radius * 2);
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
