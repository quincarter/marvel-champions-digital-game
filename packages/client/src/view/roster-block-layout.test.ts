import { describe, expect, test } from "vitest";
import { rosterBlockAt } from "./roster-block-layout.js";

describe("rosterBlockAt", () => {
  test("stacks search, chips and list in order, none overlapping", () => {
    const block = rosterBlockAt({ x: 10, y: 20, width: 300, chipRows: 2, listRows: 3 });
    expect(block.search.y).toBe(20);
    expect(block.chips.y).toBeGreaterThanOrEqual(block.search.y + block.search.height);
    expect(block.list.y).toBeGreaterThanOrEqual(block.chips.y + block.chips.height);
    expect(block.bottom).toBe(block.list.y + block.list.height);
  });

  test("zero chip rows still leaves room, just none for the chip strip", () => {
    const block = rosterBlockAt({ x: 0, y: 0, width: 200, chipRows: 0, listRows: 2 });
    expect(block.chips.height).toBe(0);
  });

  test("every rect shares the same x/width", () => {
    const block = rosterBlockAt({ x: 40, y: 0, width: 250, chipRows: 1, listRows: 1 });
    for (const rect of [block.search, block.chips, block.list]) {
      expect(rect.x).toBe(40);
      expect(rect.width).toBe(250);
    }
  });
});
