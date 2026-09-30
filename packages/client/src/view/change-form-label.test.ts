/**
 * QA fix H: the changeForm button's label must keep the verb "Flip", and it
 * must fit the quarter-width cell the stacked (phone / tablet-portrait)
 * action bar gives it, at both 390 (phone) and 768 (tablet portrait) — the
 * two widths QA found it truncating to a bare "TO HERO" / "TO A-E" at.
 */
import { describe, expect, test } from "vitest";
import { changeFormLabel } from "./change-form-label.js";
import { minChipCellWidth } from "./chip-layout.js";

/** `scenes/board/action-bar.ts` `drawActionBar`'s own cellWidth for one of the four `BASICS` cells in the stacked bar. */
function stackedCellWidth(actionBarWidth: number): number {
  const basicsWidth = actionBarWidth - 20;
  return (basicsWidth - 3 * 6) / 4;
}

describe("changeFormLabel", () => {
  test("the wide (non-stacked) bar spells the flip out in full", () => {
    expect(changeFormLabel("hero", false)).toBe("Flip to alter-ego");
    expect(changeFormLabel("alterEgo", false)).toBe("Flip to hero");
  });

  test("the stacked bar's short label still says Flip, not a bare destination", () => {
    expect(changeFormLabel("hero", true)).toContain("Flip");
    expect(changeFormLabel("alterEgo", true)).toContain("Flip");
  });

  test("the stacked label fits its quarter-width cell at phone (390) and tablet-portrait (768) width", () => {
    for (const width of [390, 768]) {
      const cellWidth = stackedCellWidth(width);
      for (const form of ["hero", "alterEgo"] as const) {
        const label = changeFormLabel(form, true);
        expect(minChipCellWidth(label)).toBeLessThanOrEqual(cellWidth);
      }
    }
  });
});
