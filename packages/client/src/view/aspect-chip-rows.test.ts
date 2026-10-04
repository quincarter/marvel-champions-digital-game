import { describe, expect, test } from "vitest";
import { packChipRows, widestRow } from "./aspect-chip-rows.js";

describe("packChipRows", () => {
  test("keeps chips that fit on one line", () => {
    expect(packChipRows([80, 70], 6, 200)).toEqual([[0, 1]]);
    expect(packChipRows([], 6, 200)).toEqual([]);
  });

  test("breaks four chips (Adam Warlock) onto a second line instead of running off the edge", () => {
    // Aggression, Justice, Leadership, Protection in the ~250 px a phone row leaves: two and two.
    const widths = [90, 76, 96, 94];
    const rows = packChipRows(widths, 6, 250);
    expect(rows).toEqual([
      [0, 1],
      [2, 3],
    ]);
    for (const row of rows) {
      expect(row.reduce((s, i) => s + widths[i]!, 0) + 6 * (row.length - 1)).toBeLessThanOrEqual(250);
    }
    expect(widestRow(widths, rows, 6)).toBe(196);
  });

  test("a chip wider than a line is alone on its own", () => {
    expect(packChipRows([40, 300, 40], 6, 100)).toEqual([[0], [1], [2]]);
  });
});
