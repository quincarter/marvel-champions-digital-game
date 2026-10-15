import { describe, expect, it } from "vitest";
import {
  CHIP_MIN_TILE_HEIGHT,
  chipLinesFor,
  engagedChipHeadroom,
  engagedChipWords,
  engagedChipRows,
  engagedChipStackHeight,
  settleChipRoom,
} from "./engaged-chips.js";

const free = { heldBy: null, engagedName: null, inactiveKeywords: [] as string[] };
const held = { heldBy: { kind: "held" as const }, engagedName: null, inactiveKeywords: ["guard"] };

describe("engagedChipRows", () => {
  it("a free minion in a one-seat game has no chip", () => {
    expect(engagedChipRows(free)).toEqual([]);
    expect(engagedChipStackHeight(free, 90)).toBe(0);
  });

  it("a held minion says HELD and which keyword is off, as two rows about its own tile", () => {
    expect(engagedChipRows(held).map((row) => row.words)).toEqual(["held", "guard off"]);
    expect(engagedChipRows(held).every((row) => row.bounded)).toBe(true);
  });

  it("vs-chips are not bounded: a small tile gets a wider chip, never a wrapped name", () => {
    const rows = engagedChipRows({ ...free, engagedName: "Spider-Man" });
    expect(rows[0]).toMatchObject({ words: "vs Spider-Man", bounded: false });
    expect(chipLinesFor(rows[0]!, 70)).toBe(1);
  });
});

describe("engagedChipWords", () => {
  it("keeps the whole name when it fits the tile", () => {
    expect(engagedChipWords("Hercules", 85)).toBe("vs Hercules");
    expect(engagedChipWords("Wonder Man", 160)).toBe("vs Wonder Man");
    expect(engagedChipWords("Wonder Man", Infinity)).toBe("vs Wonder Man");
  });

  it("shortens a long name to initials but the last word, instead of ending in an ellipsis", () => {
    expect(engagedChipWords("Wonder Man", 85)).toBe("vs W. Man");
    expect(engagedChipWords("Captain Marvel", 85)).toBe("vs C. Marvel");
    expect(engagedChipWords("Spider-Man", 85)).toBe("vs S.-Man");
    expect(engagedChipWords("Doctor Strange", 360 / 4)).toBe("vs D. Strange");
  });

  it("drops an alter ego's parenthetical before shortening", () => {
    expect(engagedChipWords("Spider-Man (Peter Parker)", 120)).toBe("vs Spider-Man");
    expect(engagedChipWords("Spider-Man (Peter Parker)", 85)).toBe("vs S.-Man");
    expect(engagedChipWords("Spider-Man (Peter Parker)", 360)).toBe("vs Spider-Man (Peter Parker)");
  });

  it("reaches the row only through the tile width", () => {
    const rows = engagedChipRows({ ...free, engagedName: "Wonder Man" }, Infinity, 85);
    expect(rows[0]).toMatchObject({ words: "vs W. Man", bounded: false });
  });
});

describe("chip wrapping and headroom", () => {
  it("'guard off' wraps to two lines on a 55px tile instead of being cut, and stays on one on a wider tile", () => {
    const off = engagedChipRows(held)[1]!;
    expect(chipLinesFor(off, 55)).toBe(2);
    expect(chipLinesFor(off, 80)).toBe(1);
  });

  it("the stack is taller on the narrow tile, and the row reserves the tallest stack", () => {
    expect(engagedChipStackHeight(held, 55)).toBeGreaterThan(engagedChipStackHeight(held, 150));
    expect(engagedChipHeadroom([free, held], 55)).toBe(engagedChipStackHeight(held, 55));
    expect(engagedChipHeadroom([free], 55)).toBe(0);
    expect(engagedChipStackHeight(held, 55, 1)).toBeLessThan(engagedChipStackHeight(held, 55));
  });
});

describe("settleChipRoom", () => {
  const widthAt = (rowHeight: number): number => Math.round(rowHeight * 0.7);

  it("no chips, no room taken", () => {
    expect(settleChipRoom([free], 100, widthAt)).toEqual({ room: 0, maxRows: Infinity });
  });

  it("keeps both chips when the tiles stay readable", () => {
    const settled = settleChipRoom([held], 220, widthAt);
    expect(settled.maxRows).toBe(Infinity);
    expect(220 - settled.room).toBeGreaterThanOrEqual(CHIP_MIN_TILE_HEIGHT);
  });

  it("a short zone keeps only the primary chip rather than shrinking the tiles below the floor", () => {
    const settled = settleChipRoom([held], 120, widthAt);
    expect(settled.maxRows).toBe(1);
    expect(120 - Math.max(0, settled.room - 8)).toBeGreaterThanOrEqual(CHIP_MIN_TILE_HEIGHT);
  });
});
