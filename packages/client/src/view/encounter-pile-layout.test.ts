import { describe, expect, test } from "vitest";
import { PILE_MIN_HEIGHT, encounterPileSlots, pileChipsOf } from "./encounter-pile-layout.js";

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("pileChipsOf", () => {
  test("a short pile's name and count never overlap and stay inside the box", () => {
    const box = { x: 100, y: 50, width: 137, height: 38 };
    const chips = pileChipsOf(box);
    expect(chips.mode).toBe("row");
    expect(overlaps(chips.name, chips.count)).toBe(false);
    for (const r of [chips.name, chips.count]) {
      expect(r.y).toBeGreaterThanOrEqual(box.y);
      expect(r.y + r.height).toBeLessThanOrEqual(box.y + box.height);
      expect(r.x + r.width).toBeLessThanOrEqual(box.x + box.width);
    }
  });
  test("a tall pile stacks name over count without overlap", () => {
    const chips = pileChipsOf({ x: 0, y: 0, width: 137, height: 120 });
    expect(chips.mode).toBe("stacked");
    expect(overlaps(chips.name, chips.count)).toBe(false);
  });
});

describe("encounterPileSlots", () => {
  const column = { x: 1100, y: 58, width: 135, height: 74 };
  const inside = (r: typeof column): boolean =>
    r.x >= column.x - 0.01 &&
    r.y >= column.y - 0.01 &&
    r.x + r.width <= column.x + column.width + 0.01 &&
    r.y + r.height <= column.y + column.height + 0.01;

  test("two piles keep the roomy column with the 6px gap", () => {
    const slots = encounterPileSlots({ ...column, height: 100 }, 2);
    expect(slots[0]!.height).toBeCloseTo(47);
    expect(slots[1]!.y - (slots[0]!.y + slots[0]!.height)).toBeCloseTo(6);
  });
  test("four piles in 74px become four legible rows, none overlapping or leaving the column", () => {
    const slots = encounterPileSlots(column, 4);
    expect(slots).toHaveLength(4);
    for (const slot of slots) {
      expect(slot.height).toBeGreaterThanOrEqual(PILE_MIN_HEIGHT);
      expect(inside(slot)).toBe(true);
      expect(slot.width).toBe(column.width);
    }
    for (let i = 1; i < slots.length; i += 1) expect(overlaps(slots[i - 1]!, slots[i]!)).toBe(false);
  });
  test("when rows would be slivers the piles pair up in a two-column grid", () => {
    const slots = encounterPileSlots(column, 6);
    expect(slots).toHaveLength(6);
    for (const slot of slots) {
      expect(slot.height).toBeGreaterThanOrEqual(PILE_MIN_HEIGHT);
      expect(inside(slot)).toBe(true);
    }
    for (let i = 0; i < slots.length; i += 1)
      for (let j = i + 1; j < slots.length; j += 1) expect(overlaps(slots[i]!, slots[j]!)).toBe(false);
  });
  test("a compact row's chip is centered inside its box", () => {
    const box = { x: 0, y: 0, width: 135, height: 17 };
    const chips = pileChipsOf(box);
    expect(chips.name.y).toBeGreaterThanOrEqual(1);
    expect(chips.name.y + chips.name.height).toBeLessThanOrEqual(16);
  });
});
