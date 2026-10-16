import { describe, expect, test } from "vitest";
import { SECTION_HEADING_HEIGHT, sectionedSheetLayout } from "./set-cards-layout.js";

describe("sectionedSheetLayout", () => {
  test("each section's heading sits above its own cards, sections in order, inside the panel", () => {
    const L = sectionedSheetLayout({ width: 1440, height: 980 }, [4, 5, 3]);
    expect(L.headings).toHaveLength(3);
    expect(L.sectionCells.map((cells) => cells.length)).toEqual([4, 5, 3]);
    L.sectionCells.forEach((cells, i) => {
      const heading = L.headings[i]!;
      for (const cell of cells) expect(cell.y).toBeGreaterThanOrEqual(heading.y + SECTION_HEADING_HEIGHT);
      const next = L.headings[i + 1];
      if (next) for (const cell of cells) expect(cell.y + cell.height).toBeLessThanOrEqual(next.y);
    });
    expect(L.headings[0]!.y).toBe(L.body.y);
    expect(L.panel.y).toBeGreaterThanOrEqual(0);
    expect(L.panel.y + L.panel.height).toBeLessThanOrEqual(980);
    expect(L.footer.y + L.footer.height).toBe(L.panel.y + L.panel.height);
    expect(L.contentHeight).toBe(L.sectionCells.at(-1)!.at(-1)!.y + L.sectionCells.at(-1)!.at(-1)!.height - L.body.y);
  });

  test("a phone keeps the panel on screen and scrolls the sections", () => {
    const L = sectionedSheetLayout({ width: 390, height: 844 }, [7, 7, 7]);
    expect(L.panel.x).toBeGreaterThanOrEqual(0);
    expect(L.panel.x + L.panel.width).toBeLessThanOrEqual(390);
    expect(L.contentHeight).toBeGreaterThan(L.body.height);
  });

  test("a taller header and no footer: the body starts lower and runs to the panel's foot", () => {
    const plain = sectionedSheetLayout({ width: 1440, height: 980 }, [20, 20]);
    const L = sectionedSheetLayout({ width: 1440, height: 980 }, [20, 20], 1, { extraHeader: 16, footer: false });
    expect(L.body.y - L.panel.y).toBe(plain.body.y - plain.panel.y + 16);
    expect(L.panel.y + L.panel.height - (L.body.y + L.body.height)).toBeLessThan(
      plain.panel.y + plain.panel.height - (plain.body.y + plain.body.height),
    );
  });
});
