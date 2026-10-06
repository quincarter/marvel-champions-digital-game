import { describe, expect, it } from "vitest";
import { TEAM_ROW_MAX, TEAM_ROW_MIN, seatLineOffsets, teamLayout } from "./team-layout.js";
import { boardLayout, rectsOverlap, type Rect } from "./layout.js";

const panel = (height: number): Rect => ({ x: 1000, y: 100, width: 260, height });

describe("teamLayout", () => {
  it("keeps the caption and the roomy rows on a tall panel", () => {
    const layout = teamLayout(panel(300), 3);
    expect(layout.header).toBe(true);
    expect(layout.rows.every((row) => row.height === TEAM_ROW_MAX)).toBe(true);
  });

  it("drops the caption, not the rows, when 3 others share a 115px panel (1280x560)", () => {
    const layout = teamLayout(panel(115), 3);
    expect(layout.header).toBe(false);
    expect(layout.rowStyle).toBe("two-line");
    expect(layout.rows).toHaveLength(3);
    for (const row of layout.rows) expect(row.height).toBeGreaterThanOrEqual(TEAM_ROW_MIN);
  });

  it("never overlaps rows or leaves the panel, at any height and count", () => {
    for (const height of [60, 80, 100, 115, 140, 200, 300, 500]) {
      for (const count of [1, 2, 3]) {
        const rect = panel(height);
        const { rows } = teamLayout(rect, count);
        expect(rows).toHaveLength(count);
        rows.forEach((row, i) => {
          expect(row.y + row.height, `${count} in ${height}`).toBeLessThanOrEqual(rect.y + rect.height + 1e-6);
          rows.slice(i + 1).forEach((other) => expect(rectsOverlap(row, other)).toBe(false));
        });
      }
    }
  });

  it("falls to one line per row when even the two-line minimum cannot fit", () => {
    const layout = teamLayout(panel(80), 3);
    expect(layout.rowStyle).toBe("one-line");
  });

  it("fits the real long-table panel at 1280x560 with three others, two-line", () => {
    const { zones } = boardLayout({ x: 0, y: 0, width: 1280, height: 560 }, { playerCount: 4 });
    const layout = teamLayout(zones.team!, 3);
    expect(layout.rowStyle).toBe("two-line");
    for (const row of layout.rows) expect(row.height).toBeGreaterThanOrEqual(TEAM_ROW_MIN);
  });

  it("puts the detail line inside a short row", () => {
    const { detail } = seatLineOffsets(TEAM_ROW_MIN);
    expect(detail + 11).toBeLessThanOrEqual(TEAM_ROW_MIN);
  });
});

describe("teamLayout chip strips", () => {
  it("gives a seat with usable cards a 24px strip under its row and shifts the rows below it", () => {
    const plain = teamLayout(panel(400), 2);
    expect(plain.chips).toEqual([null, null]);
    const withChips = teamLayout(panel(400), 2, [true, false]);
    const first = withChips.rows[0]!;
    expect(withChips.chips[0]).toEqual({ x: first.x, y: first.y + first.height + 2, width: first.width, height: 24 });
    expect(withChips.chips[1]).toBeNull();
    expect(withChips.rows[1]!.y).toBeGreaterThanOrEqual(withChips.chips[0]!.y + 24);
    const last = withChips.rows[1]!;
    expect(last.y + last.height).toBeLessThanOrEqual(panel(400).y + panel(400).height);
  });
});
