import { describe, expect, test } from "vitest";
import { rectsOverlap } from "./layout.js";
import { GROUP_GAP, GROUP_LABEL_GAP, GROUP_LABEL_HEIGHT, modularGridPlan } from "./modular-grid-plan.js";

const base = { width: 700, columns: 4, cardHeight: 58, gap: 8 };

describe("modularGridPlan", () => {
  test("one unlabeled section is the plain grid: rows of equal tiles with the gap between", () => {
    const plan = modularGridPlan({ ...base, sections: [{ id: "all", label: null, itemCount: 6 }] });
    expect(plan.cells).toHaveLength(6);
    expect(plan.headers).toEqual([]);
    expect(plan.contentHeight).toBe(2 * 58 + 8);
    expect(plan.cells[4]!.y).toBe(58 + 8);
    expect(plan.cells[0]!.width).toBe((700 - 3 * 8) / 4);
  });

  test("a labeled section puts its label above its tiles, and sections are a group gap apart", () => {
    const plan = modularGridPlan({
      ...base,
      sections: [
        { id: "a", label: "A · 5", itemCount: 5 },
        { id: "b", label: "B · 1", itemCount: 1 },
      ],
    });
    expect(plan.headers.map((h) => h.label)).toEqual(["A · 5", "B · 1"]);
    expect(plan.headers[0]!.rect.y).toBe(0);
    expect(plan.cells[0]!.y).toBe(GROUP_LABEL_HEIGHT + GROUP_LABEL_GAP);
    const aBottom = plan.cells[4]!.y + 58;
    expect(plan.headers[1]!.rect.y).toBe(aBottom + GROUP_GAP);
    expect(plan.cells[5]!.y).toBe(plan.headers[1]!.rect.y + GROUP_LABEL_HEIGHT + GROUP_LABEL_GAP);
    expect(plan.contentHeight).toBe(plan.cells[5]!.y + 58);
  });

  test("row heights sum to the content height and every item names a real row", () => {
    const plan = modularGridPlan({
      ...base,
      sections: [
        { id: "a", label: "A", itemCount: 9 },
        { id: "b", label: "B", itemCount: 2 },
      ],
    });
    expect(plan.rowHeights.reduce((sum, h) => sum + h, 0)).toBe(plan.contentHeight);
    for (const row of plan.rowOfItem) expect(plan.rowHeights[row]).toBeGreaterThan(0);
    expect(plan.rowOfItem).toHaveLength(plan.cells.length);
  });

  test("no tile overlaps another tile or a label", () => {
    const plan = modularGridPlan({
      ...base,
      sections: [
        { id: "a", label: "A", itemCount: 7 },
        { id: "b", label: "B", itemCount: 3 },
        { id: "c", label: null, itemCount: 5 },
      ],
    });
    const rects = [...plan.cells, ...plan.headers.map((h) => h.rect)];
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i]!, rects[j]!)).toBe(false);
  });

  test("an empty section draws nothing, not even its label", () => {
    const plan = modularGridPlan({
      ...base,
      sections: [
        { id: "a", label: "A", itemCount: 0 },
        { id: "b", label: "B", itemCount: 1 },
      ],
    });
    expect(plan.headers.map((h) => h.sectionId)).toEqual(["b"]);
    expect(plan.headers[0]!.rect.y).toBe(0);
  });
});
